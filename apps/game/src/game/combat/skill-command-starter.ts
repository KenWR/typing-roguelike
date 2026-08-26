import {
  createSkillActionDefinition,
  type SkillDefinition,
} from "@typing-roguelike/shared";
import {
  type CommandInputBuffer,
  type CommandCompletedEvent,
} from "../input/command-input-buffer";
import {
  ActionPointResource,
  type ActionPointSnapshot,
} from "./action-point-resource";
import { CombatState, type CombatUpdate } from "./combat-state";
import { ComboTracker, type ComboSnapshot } from "./combo-tracker";

export type SkillStartFailureReason =
  | "unknown-command"
  | "combat-unavailable"
  | "insufficient-ap";

export type SkillStartResult =
  | Readonly<{
      started: true;
      skill: SkillDefinition;
      actionId: string;
      ap: ActionPointSnapshot;
      combat: CombatUpdate;
      combo: ComboSnapshot;
    }>
  | Readonly<{
      started: false;
      command: string;
      reason: SkillStartFailureReason;
      ap: ActionPointSnapshot;
      combo: ComboSnapshot;
    }>;

export type SkillStartListener = (result: SkillStartResult) => void;

export type SkillCommandStarterConfig = Readonly<{
  skills: readonly SkillDefinition[];
  actionPoints: ActionPointResource;
  combat: CombatState;
  actorId: string;
  targetId: string;
  combo?: ComboTracker;
  resolveApCost?: (skill: SkillDefinition) => number;
  /** 커맨드를 완성할 때마다 대상을 다시 계산합니다. Tab 타게팅에 사용합니다. */
  resolveTargetId?: (skill: SkillDefinition) => string;
}>;

const normalizeCommand = (command: string): string => command.normalize("NFC");

const requireIdentifier = (name: string, value: string): string => {
  if (value.trim().length === 0) throw new RangeError(`${name} must not be empty.`);
  return value;
};

const validateApCost = (cost: number): number => {
  if (!Number.isFinite(cost) || cost < 0) {
    throw new RangeError("Resolved skill AP cost must be a finite non-negative number.");
  }
  return cost;
};

export class SkillCommandStarter {
  private readonly skillsByCommand = new Map<string, SkillDefinition>();
  private readonly actionPoints: ActionPointResource;
  private readonly combat: CombatState;
  private readonly combo: ComboTracker;
  private readonly actorId: string;
  private readonly targetId: string;
  private readonly resolveApCost: (skill: SkillDefinition) => number;
  private readonly resolveTargetId: (skill: SkillDefinition) => string;
  private nextActionSequence = 1;

  constructor(config: SkillCommandStarterConfig) {
    this.actionPoints = config.actionPoints;
    this.combat = config.combat;
    this.combo = config.combo ?? new ComboTracker();
    this.actorId = requireIdentifier("Actor id", config.actorId);
    this.targetId = requireIdentifier("Target id", config.targetId);
    this.resolveApCost = config.resolveApCost ?? ((skill) => skill.apCost);
    this.resolveTargetId = config.resolveTargetId ?? (() => this.targetId);

    for (const skill of config.skills) {
      const command = normalizeCommand(skill.command);
      if (this.skillsByCommand.has(command)) throw new Error(`Duplicate skill command: ${skill.command}`);
      this.skillsByCommand.set(command, skill);
    }
  }

  get comboSnapshot(): ComboSnapshot { return this.combo.snapshot; }

  breakCombo(reason: Parameters<ComboTracker["breakCombo"]>[0]): ComboSnapshot {
    return this.combo.breakCombo(reason);
  }

  connect(inputBuffer: CommandInputBuffer, listener: SkillStartListener): () => void {
    const disconnectCompleted = inputBuffer.onCompleted((event) => listener(this.tryStart(event)));
    const disconnectStatus = inputBuffer.onStatusChanged((event) => {
      if (event.snapshot.status === "incorrect") this.combo.breakCombo("incorrect-input");
    });
    return () => {
      disconnectCompleted();
      disconnectStatus();
    };
  }

  tryStart(event: CommandCompletedEvent): SkillStartResult {
    const skill = this.skillsByCommand.get(normalizeCommand(event.command));
    if (!skill) return this.failure(event.command, "unknown-command");
    if (!this.combat.snapshot.canAcceptInput) return this.failure(event.command, "combat-unavailable");

    const spend = this.actionPoints.trySpend(validateApCost(this.resolveApCost(skill)));
    if (!spend.accepted) {
      return {
        started: false,
        command: event.command,
        reason: "insufficient-ap",
        ap: spend.snapshot,
        combo: this.combo.snapshot,
      };
    }

    const actionId = this.createActionId(skill.id);
    const combat = this.combat.startAction(
      createSkillActionDefinition(skill, {
        actionId,
        actorId: this.actorId,
        targetId: requireIdentifier("Target id", this.resolveTargetId(skill)),
      }),
    );
    const combo = this.combo.recordCorrectInput();
    return { started: true, skill, actionId, ap: spend.snapshot, combat, combo };
  }

  private failure(
    command: string,
    reason: Exclude<SkillStartFailureReason, "insufficient-ap">,
  ): SkillStartResult {
    return {
      started: false,
      command,
      reason,
      ap: this.actionPoints.snapshot,
      combo: this.combo.snapshot,
    };
  }

  private createActionId(skillId: string): string {
    let actionId: string;
    do {
      actionId = `${this.actorId}:${skillId}:${this.nextActionSequence}`;
      this.nextActionSequence += 1;
    } while (this.combat.snapshot.actions.some((action) => action.id === actionId));
    return actionId;
  }
}
