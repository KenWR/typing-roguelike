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
import {
  CombatState,
  type CombatUpdate,
} from "./combat-state";

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
    }>
  | Readonly<{
      started: false;
      command: string;
      reason: SkillStartFailureReason;
      ap: ActionPointSnapshot;
    }>;

export type SkillStartListener = (result: SkillStartResult) => void;

export type SkillCommandStarterConfig = Readonly<{
  skills: readonly SkillDefinition[];
  actionPoints: ActionPointResource;
  combat: CombatState;
  actorId: string;
  targetId: string;
}>;

const normalizeCommand = (command: string): string => command.normalize("NFC");

const requireIdentifier = (name: string, value: string): string => {
  if (value.trim().length === 0) {
    throw new RangeError(`${name} must not be empty.`);
  }

  return value;
};

export class SkillCommandStarter {
  private readonly skillsByCommand = new Map<string, SkillDefinition>();
  private readonly actionPoints: ActionPointResource;
  private readonly combat: CombatState;
  private readonly actorId: string;
  private readonly targetId: string;
  private nextActionSequence = 1;

  constructor(config: SkillCommandStarterConfig) {
    this.actionPoints = config.actionPoints;
    this.combat = config.combat;
    this.actorId = requireIdentifier("Actor id", config.actorId);
    this.targetId = requireIdentifier("Target id", config.targetId);

    for (const skill of config.skills) {
      const command = normalizeCommand(skill.command);
      if (this.skillsByCommand.has(command)) {
        throw new Error(`Duplicate skill command: ${skill.command}`);
      }
      this.skillsByCommand.set(command, skill);
    }
  }

  connect(
    inputBuffer: CommandInputBuffer,
    listener: SkillStartListener,
  ): () => void {
    return inputBuffer.onCompleted((event) => {
      listener(this.tryStart(event));
    });
  }

  tryStart(event: CommandCompletedEvent): SkillStartResult {
    const skill = this.skillsByCommand.get(normalizeCommand(event.command));

    if (!skill) {
      return this.failure(event.command, "unknown-command");
    }

    if (!this.combat.snapshot.canAcceptInput) {
      return this.failure(event.command, "combat-unavailable");
    }

    const spend = this.actionPoints.trySpend(skill.apCost);
    if (!spend.accepted) {
      return {
        started: false,
        command: event.command,
        reason: "insufficient-ap",
        ap: spend.snapshot,
      };
    }

    const actionId = this.createActionId(skill.id);
    const combat = this.combat.startAction(
      createSkillActionDefinition(skill, {
        actionId,
        actorId: this.actorId,
        targetId: this.targetId,
      }),
    );

    return {
      started: true,
      skill,
      actionId,
      ap: spend.snapshot,
      combat,
    };
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
    };
  }

  private createActionId(skillId: string): string {
    let actionId: string;

    do {
      actionId = `${this.actorId}:${skillId}:${this.nextActionSequence}`;
      this.nextActionSequence += 1;
    } while (
      this.combat.snapshot.actions.some((action) => action.id === actionId)
    );

    return actionId;
  }
}
