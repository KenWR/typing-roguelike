import type { EnemyActionConfig, EnemyConfig } from "@typing-roguelike/shared";
import {
  EnemyAttackTimeline,
  type EnemyAttackTimelineUpdate,
  type EnemyAttackType,
} from "./enemy-attack-timeline";

export const ENEMY_COMMAND_WINDUP_MULTIPLIER = 2 as const;

export const applyEnemyCommandWindupMultiplier = (windupMs: number): number =>
  windupMs * ENEMY_COMMAND_WINDUP_MULTIPLIER;

export type EnemyCombatantState = Readonly<{
  enemy: Readonly<EnemyConfig>;
  currentHp: number;
}>;

export type EnemyAttackSelectionResult = Readonly<{
  started: boolean;
  enemyId: string;
  action: Readonly<EnemyActionConfig> | null;
  update: EnemyAttackTimelineUpdate | null;
}>;

export type EnemyAttackSelectionRandom = () => number;

const toAttackType = (action: Readonly<EnemyActionConfig>): EnemyAttackType => {
  if (action.kind === "defense") {
    return "defense";
  }

  return "attack";
};

const validateRandomValue = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Enemy attack selection random value must be in [0, 1).");
  }

  return value;
};

export class EnemyAttackSelectionLoop {
  private nextTimelineSequence = 1;

  constructor(
    private readonly timeline: EnemyAttackTimeline,
    private readonly random: EnemyAttackSelectionRandom = Math.random,
  ) {}

  selectAndStart(
    combatant: EnemyCombatantState,
    targetId: string,
  ): EnemyAttackSelectionResult {
    if (combatant.currentHp <= 0 || this.timeline.snapshot.status !== "active") {
      return {
        started: false,
        enemyId: combatant.enemy.id,
        action: null,
        update: null,
      };
    }

    if (combatant.enemy.actions.length === 0) {
      return {
        started: false,
        enemyId: combatant.enemy.id,
        action: null,
        update: null,
      };
    }

    const randomValue = validateRandomValue(this.random());
    const actionIndex = Math.min(
      Math.floor(randomValue * combatant.enemy.actions.length),
      combatant.enemy.actions.length - 1,
    );
    const action = combatant.enemy.actions[actionIndex];

    if (action === undefined) {
      return {
        started: false,
        enemyId: combatant.enemy.id,
        action: null,
        update: null,
      };
    }

    const timelineId = `${combatant.enemy.id}:${action.id}:${this.nextTimelineSequence}`;
    this.nextTimelineSequence += 1;

    const update = this.timeline.startAttack({
      timelineId,
      enemyId: combatant.enemy.id,
      targetId,
      attackId: action.id,
      attackName: action.name,
      attackType: toAttackType(action),
      windupMs: applyEnemyCommandWindupMultiplier(action.windupMs),
      recoveryMs: action.recoveryMs,
    });

    return {
      started: true,
      enemyId: combatant.enemy.id,
      action,
      update,
    };
  }
}
