import {
  CombatState,
  type CombatActionEvent,
  type CombatActionSnapshot,
  type CombatOutcome,
  type CombatStatus,
  type CombatUpdate,
} from "./combat-state";

export type EnemyAttackType = "attack" | "defense" | "buff" | "debuff";

export type EnemyAttackDefinition = Readonly<{
  timelineId: string;
  enemyId: string;
  targetId: string;
  attackId: string;
  attackName: string;
  attackType: EnemyAttackType;
  windupMs: number;
  recoveryMs: number;
}>;

export type EnemyAttackPhase = CombatActionSnapshot["phase"];

export type EnemyAttackSnapshot = Readonly<{
  timelineId: string;
  enemyId: string;
  targetId: string;
  attackId: string;
  attackName: string;
  attackType: EnemyAttackType;
  phase: EnemyAttackPhase;
  phaseElapsedMs: number;
  phaseDurationMs: number;
  phaseProgress: number;
  castCompleted: boolean;
  impactResolved: boolean;
}>;

export type EnemyAttackTimelineSnapshot = Readonly<{
  status: CombatStatus;
  elapsedMs: number;
  attacks: readonly EnemyAttackSnapshot[];
}>;

export type EnemyAttackEvent = Readonly<{
  type: CombatActionEvent["type"];
  timelineId: string;
  enemyId: string;
  targetId: string;
  attackId: string;
  attackType: EnemyAttackType;
  atMs: number;
}>;

export type EnemyAttackTimelineUpdate = Readonly<{
  snapshot: EnemyAttackTimelineSnapshot;
  events: readonly EnemyAttackEvent[];
}>;

type EnemyAttackMetadata = Readonly<{
  enemyId: string;
  targetId: string;
  attackId: string;
  attackName: string;
  attackType: EnemyAttackType;
}>;

const validateLabel = (name: string, value: string): string => {
  if (value.trim().length === 0) {
    throw new RangeError(`${name} must not be empty.`);
  }

  return value;
};

export class EnemyAttackTimeline {
  private readonly combat = new CombatState();
  private readonly metadataByTimelineId = new Map<
    string,
    EnemyAttackMetadata
  >();

  get snapshot(): EnemyAttackTimelineSnapshot {
    return this.toTimelineSnapshot(this.combat.snapshot);
  }

  startAttack(definition: EnemyAttackDefinition): EnemyAttackTimelineUpdate {
    const timelineId = validateLabel("Timeline id", definition.timelineId);
    if (this.metadataByTimelineId.has(timelineId)) {
      throw new Error(`Timeline id already exists: ${timelineId}`);
    }

    const metadata: EnemyAttackMetadata = {
      enemyId: validateLabel("Enemy id", definition.enemyId),
      targetId: validateLabel("Target id", definition.targetId),
      attackId: validateLabel("Attack id", definition.attackId),
      attackName: validateLabel("Attack name", definition.attackName),
      attackType: definition.attackType,
    };

    const update = this.combat.startAction({
      id: timelineId,
      actorId: metadata.enemyId,
      targetId: metadata.targetId,
      windupMs: definition.windupMs,
      recoveryMs: definition.recoveryMs,
    });

    this.metadataByTimelineId.set(timelineId, metadata);
    return this.toTimelineUpdate(update);
  }

  /** 선딜 중 실드가 깨진 적의 행동을 취소합니다. */
  cancelAttack(timelineId: string): boolean {
    if (!this.combat.cancelAction(timelineId)) return false;
    this.metadataByTimelineId.delete(timelineId);
    return true;
  }

  advance(deltaMs: number): EnemyAttackTimelineUpdate {
    return this.toTimelineUpdate(this.combat.advance(deltaMs));
  }

  pause(): EnemyAttackTimelineSnapshot {
    return this.toTimelineSnapshot(this.combat.pause());
  }

  resume(): EnemyAttackTimelineSnapshot {
    return this.toTimelineSnapshot(this.combat.resume());
  }

  finish(outcome: CombatOutcome): EnemyAttackTimelineSnapshot {
    return this.toTimelineSnapshot(this.combat.finish(outcome));
  }

  private toTimelineUpdate(update: CombatUpdate): EnemyAttackTimelineUpdate {
    return {
      snapshot: this.toTimelineSnapshot(update.snapshot),
      events: update.events.map((event) => this.toEnemyAttackEvent(event)),
    };
  }

  private toTimelineSnapshot(
    snapshot: ReturnType<CombatState["pause"]>,
  ): EnemyAttackTimelineSnapshot {
    return {
      status: snapshot.status,
      elapsedMs: snapshot.elapsedMs,
      attacks: snapshot.actions.map((action) =>
        this.toEnemyAttackSnapshot(action),
      ),
    };
  }

  private toEnemyAttackSnapshot(
    action: CombatActionSnapshot,
  ): EnemyAttackSnapshot {
    const metadata = this.getMetadata(action.id);

    return {
      timelineId: action.id,
      enemyId: metadata.enemyId,
      targetId: metadata.targetId,
      attackId: metadata.attackId,
      attackName: metadata.attackName,
      attackType: metadata.attackType,
      phase: action.phase,
      phaseElapsedMs: action.phaseElapsedMs,
      phaseDurationMs: action.phaseDurationMs,
      phaseProgress: action.phaseProgress,
      castCompleted: action.castCompleted,
      impactResolved: action.impactResolved,
    };
  }

  private toEnemyAttackEvent(event: CombatActionEvent): EnemyAttackEvent {
    const metadata = this.getMetadata(event.actionId);

    return {
      type: event.type,
      timelineId: event.actionId,
      enemyId: metadata.enemyId,
      targetId: metadata.targetId,
      attackId: metadata.attackId,
      attackType: metadata.attackType,
      atMs: event.atMs,
    };
  }

  private getMetadata(timelineId: string): EnemyAttackMetadata {
    const metadata = this.metadataByTimelineId.get(timelineId);
    if (metadata === undefined) {
      throw new Error(`Missing enemy attack metadata: ${timelineId}`);
    }

    return metadata;
  }
}
