import type Phaser from "phaser";
import { ENEMY_HEALTH_BAR_TRACK_WIDTH } from "../combat/enemy-health-bar";
import type {
  EnemyAttackPhase,
  EnemyAttackSnapshot,
  EnemyAttackTimelineSnapshot,
  EnemyAttackType,
} from "../combat/enemy-attack-timeline";

export type EnemyAttackTypePresentation = Readonly<{
  icon: string;
  label: string;
  color: string;
  accent: number;
}>;

export const ENEMY_ATTACK_TYPE_PRESENTATION: Readonly<Record<EnemyAttackType, EnemyAttackTypePresentation>> = {
  attack: {
    icon: "⚔",
    label: "공격",
    color: "#fb7185",
    accent: 0xe11d48,
  },
  defense: {
    icon: "🛡",
    label: "방어",
    color: "#93c5fd",
    accent: 0x3b82f6,
  },
  buff: {
    icon: "✦",
    label: "강화",
    color: "#fcd34d",
    accent: 0xf59e0b,
  },
  debuff: {
    icon: "☠",
    label: "약화",
    color: "#c4b5fd",
    accent: 0x8b5cf6,
  },
};

export const ENEMY_ATTACK_PHASE_LABEL: Readonly<Record<EnemyAttackPhase, string>> = {
  windup: "선딜",
  recovery: "후딜",
  resolved: "완료",
};

export type EnemyAttackGaugeAttackState = Readonly<{
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
  progress: number;
  phaseLabel: string;
  icon: string;
  typeLabel: string;
  color: string;
  accent: number;
  targeted: boolean;
}>;

export type EnemyAttackGaugeState = Readonly<{
  status: EnemyAttackTimelineSnapshot["status"];
  elapsedMs: number;
  attacks: readonly EnemyAttackGaugeAttackState[];
}>;

export const ENEMY_ATTACK_GAUGE_TRACK_WIDTH = ENEMY_HEALTH_BAR_TRACK_WIDTH;
export const ENEMY_ATTACK_GAUGE_VISIBLE = false;

const clampProgress = (value: number): number => Math.min(Math.max(0, value), 1);

const getGaugeProgress = (attack: EnemyAttackSnapshot): number =>
  attack.phase === "windup" ? clampProgress(attack.phaseProgress) : 1;

export function getEnemyAttackTypePresentation(attackType: EnemyAttackType): EnemyAttackTypePresentation {
  return ENEMY_ATTACK_TYPE_PRESENTATION[attackType];
}

export function createEnemyAttackGaugeState(
  snapshot: EnemyAttackTimelineSnapshot,
  targetedEnemyId?: string,
): EnemyAttackGaugeState {
  return {
    status: snapshot.status,
    elapsedMs: snapshot.elapsedMs,
    attacks: snapshot.attacks
      .filter((attack) => attack.phase !== "resolved")
      .map((attack) => {
        const presentation = getEnemyAttackTypePresentation(attack.attackType);

        return {
          timelineId: attack.timelineId,
          enemyId: attack.enemyId,
          targetId: attack.targetId,
          attackId: attack.attackId,
          attackName: attack.attackName,
          attackType: attack.attackType,
          phase: attack.phase,
          phaseElapsedMs: attack.phaseElapsedMs,
          phaseDurationMs: attack.phaseDurationMs,
          phaseProgress: clampProgress(attack.phaseProgress),
          progress: getGaugeProgress(attack),
          phaseLabel: ENEMY_ATTACK_PHASE_LABEL[attack.phase],
          icon: presentation.icon,
          typeLabel: presentation.label,
          color: presentation.color,
          accent: presentation.accent,
          targeted: targetedEnemyId !== undefined && attack.enemyId === targetedEnemyId,
        };
      }),
  };
}

/**
 * Compatibility adapter for callers that still synchronize the former global
 * attack gauge. Telegraph rendering now lives on each enemy health bar, so this
 * object intentionally owns no visible children.
 */
export class EnemyAttackGauge {
  readonly container: Phaser.GameObjects.Container;

  private state: EnemyAttackGaugeState;
  private lastSnapshot: EnemyAttackTimelineSnapshot;
  private targetedEnemyId?: string;

  constructor(scene: Phaser.Scene, initialSnapshot: EnemyAttackTimelineSnapshot) {
    this.lastSnapshot = initialSnapshot;
    this.state = createEnemyAttackGaugeState(initialSnapshot);
    this.container = scene.add.container(0, 0).setVisible(ENEMY_ATTACK_GAUGE_VISIBLE);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setSize(width: number, height: number): void {
    this.container.setSize(Math.max(0, width), Math.max(0, height));
  }

  update(snapshot: EnemyAttackTimelineSnapshot): void {
    this.lastSnapshot = snapshot;
    this.state = createEnemyAttackGaugeState(snapshot, this.targetedEnemyId);
  }

  setTargetedEnemy(enemyId: string | undefined): void {
    this.targetedEnemyId = enemyId;
    this.state = createEnemyAttackGaugeState(this.lastSnapshot, enemyId);
  }

  getState(): EnemyAttackGaugeState {
    return {
      ...this.state,
      attacks: this.state.attacks.map((attack) => ({ ...attack })),
    };
  }
}
