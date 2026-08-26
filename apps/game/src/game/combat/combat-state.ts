export type CombatStatus = "active" | "paused" | "victory" | "defeat";

export type CombatOutcome = Extract<CombatStatus, "victory" | "defeat">;

export type CombatActionPhase = "windup" | "recovery" | "resolved";

export type CombatActionDefinition = Readonly<{
  id: string;
  actorId: string;
  targetId: string;
  windupMs: number;
  recoveryMs: number;
}>;

export type CombatActionSnapshot = Readonly<{
  id: string;
  actorId: string;
  targetId: string;
  phase: CombatActionPhase;
  phaseElapsedMs: number;
  phaseDurationMs: number;
  phaseProgress: number;
  castCompleted: boolean;
  impactResolved: boolean;
}>;

export type CombatSnapshot = Readonly<{
  status: CombatStatus;
  elapsedMs: number;
  canAcceptInput: boolean;
  actions: readonly CombatActionSnapshot[];
}>;

export type CombatActionEvent = Readonly<{
  type: "cast-completed" | "impact-resolved";
  actionId: string;
  actorId: string;
  targetId: string;
  atMs: number;
}>;

export type CombatUpdate = Readonly<{
  snapshot: CombatSnapshot;
  events: readonly CombatActionEvent[];
}>;

type MutableCombatAction = {
  readonly id: string;
  readonly actorId: string;
  readonly targetId: string;
  readonly windupMs: number;
  readonly recoveryMs: number;
  phase: CombatActionPhase;
  phaseElapsedMs: number;
};

const validateIdentifier = (name: string, value: string): string => {
  if (value.trim().length === 0) {
    throw new RangeError(`${name} must not be empty.`);
  }

  return value;
};

const validateDuration = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }

  return value;
};

const resolveProgress = (elapsedMs: number, durationMs: number): number => {
  if (durationMs === 0) {
    return 1;
  }

  return Math.min(elapsedMs / durationMs, 1);
};

export class CombatState {
  private status: CombatStatus = "active";
  private elapsedMs = 0;
  private readonly actions = new Map<string, MutableCombatAction>();

  get snapshot(): CombatSnapshot {
    return {
      status: this.status,
      elapsedMs: this.elapsedMs,
      canAcceptInput: this.status === "active",
      actions: Array.from(this.actions.values(), (action) =>
        this.toActionSnapshot(action),
      ),
    };
  }

  startAction(definition: CombatActionDefinition): CombatUpdate {
    this.assertActive("start an action");

    const id = validateIdentifier("Action id", definition.id);
    if (this.actions.has(id)) {
      throw new Error(`Action id already exists: ${id}`);
    }

    const action: MutableCombatAction = {
      id,
      actorId: validateIdentifier("Actor id", definition.actorId),
      targetId: validateIdentifier("Target id", definition.targetId),
      windupMs: validateDuration("Windup duration", definition.windupMs),
      recoveryMs: validateDuration(
        "Recovery duration",
        definition.recoveryMs,
      ),
      phase: "windup",
      phaseElapsedMs: 0,
    };

    this.actions.set(id, action);
    const events = this.advanceAction(action, 0, this.elapsedMs);

    return {
      snapshot: this.snapshot,
      events,
    };
  }

  /**
   * 진행 중인 행동을 즉시 없앱니다. 적의 실드가 선딜 중에 모두 깎여 행동이
   * 취소될 때 사용하며, 취소된 행동은 어떤 이벤트도 발생시키지 않습니다.
   */
  cancelAction(id: string): boolean {
    return this.actions.delete(validateIdentifier("Action id", id));
  }

  advance(deltaMs: number): CombatUpdate {
    validateDuration("Combat delta", deltaMs);

    if (this.status !== "active") {
      return {
        snapshot: this.snapshot,
        events: [],
      };
    }

    const intervalStartMs = this.elapsedMs;
    const events = Array.from(this.actions.values()).flatMap((action) =>
      this.advanceAction(action, deltaMs, intervalStartMs),
    );

    this.elapsedMs += deltaMs;
    events.sort((left, right) => left.atMs - right.atMs);

    return {
      snapshot: this.snapshot,
      events,
    };
  }

  pause(): CombatSnapshot {
    if (this.status === "active") {
      this.status = "paused";
    }

    return this.snapshot;
  }

  resume(): CombatSnapshot {
    if (this.status === "paused") {
      this.status = "active";
    }

    return this.snapshot;
  }

  finish(outcome: CombatOutcome): CombatSnapshot {
    if (this.status === "victory" || this.status === "defeat") {
      return this.snapshot;
    }

    this.status = outcome;
    return this.snapshot;
  }

  private assertActive(operation: string): void {
    if (this.status !== "active") {
      throw new Error(`Cannot ${operation} while combat is ${this.status}.`);
    }
  }

  private advanceAction(
    action: MutableCombatAction,
    deltaMs: number,
    intervalStartMs: number,
  ): CombatActionEvent[] {
    if (action.phase === "resolved") {
      return [];
    }

    const events: CombatActionEvent[] = [];
    let remainingDeltaMs = deltaMs;
    let consumedDeltaMs = 0;

    while (action.phase !== "resolved") {
      const phaseDurationMs =
        action.phase === "windup" ? action.windupMs : action.recoveryMs;
      const remainingPhaseMs = phaseDurationMs - action.phaseElapsedMs;

      if (remainingDeltaMs < remainingPhaseMs) {
        action.phaseElapsedMs += remainingDeltaMs;
        break;
      }

      remainingDeltaMs -= remainingPhaseMs;
      consumedDeltaMs += remainingPhaseMs;
      action.phaseElapsedMs = phaseDurationMs;

      if (action.phase === "windup") {
        events.push(
          this.createActionEvent(
            "cast-completed",
            action,
            intervalStartMs + consumedDeltaMs,
          ),
        );
        action.phase = "recovery";
        action.phaseElapsedMs = 0;
        continue;
      }

      events.push(
        this.createActionEvent(
          "impact-resolved",
          action,
          intervalStartMs + consumedDeltaMs,
        ),
      );
      action.phase = "resolved";
      action.phaseElapsedMs = 0;
    }

    return events;
  }

  private createActionEvent(
    type: CombatActionEvent["type"],
    action: MutableCombatAction,
    atMs: number,
  ): CombatActionEvent {
    return {
      type,
      actionId: action.id,
      actorId: action.actorId,
      targetId: action.targetId,
      atMs,
    };
  }

  private toActionSnapshot(
    action: MutableCombatAction,
  ): CombatActionSnapshot {
    const phaseDurationMs =
      action.phase === "windup"
        ? action.windupMs
        : action.phase === "recovery"
          ? action.recoveryMs
          : 0;

    return {
      id: action.id,
      actorId: action.actorId,
      targetId: action.targetId,
      phase: action.phase,
      phaseElapsedMs: action.phaseElapsedMs,
      phaseDurationMs,
      phaseProgress:
        action.phase === "resolved"
          ? 1
          : resolveProgress(action.phaseElapsedMs, phaseDurationMs),
      castCompleted: action.phase !== "windup",
      impactResolved: action.phase === "resolved",
    };
  }
}
