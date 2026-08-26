import Phaser from "phaser";
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

export const ENEMY_ATTACK_TYPE_PRESENTATION: Readonly<
  Record<EnemyAttackType, EnemyAttackTypePresentation>
> = {
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

export const ENEMY_ATTACK_PHASE_LABEL: Readonly<
  Record<EnemyAttackPhase, string>
> = {
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

const clampProgress = (value: number): number =>
  Math.min(Math.max(0, value), 1);

const getGaugeProgress = (attack: EnemyAttackSnapshot): number =>
  attack.phase === "windup" ? clampProgress(attack.phaseProgress) : 1;

export function getEnemyAttackTypePresentation(
  attackType: EnemyAttackType,
): EnemyAttackTypePresentation {
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

type EnemyAttackGaugeRow = {
  readonly container: Phaser.GameObjects.Container;
  readonly panel: Phaser.GameObjects.Rectangle;
  readonly icon: Phaser.GameObjects.Text;
  readonly attackName: Phaser.GameObjects.Text;
  readonly type: Phaser.GameObjects.Text;
  readonly phase: Phaser.GameObjects.Text;
  readonly track: Phaser.GameObjects.Rectangle;
  readonly fill: Phaser.GameObjects.Rectangle;
  readonly progress: Phaser.GameObjects.Text;
};

export class EnemyAttackGauge {
  readonly container: Phaser.GameObjects.Container;

  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly activeCount: Phaser.GameObjects.Text;
  private readonly emptyText: Phaser.GameObjects.Text;
  private readonly rows = new Map<string, EnemyAttackGaugeRow>();
  private state: EnemyAttackGaugeState;
  private lastSnapshot: EnemyAttackTimelineSnapshot;
  private targetedEnemyId?: string;
  private panelWidth = 420;
  private panelHeight = 132;

  constructor(
    scene: Phaser.Scene,
    initialSnapshot: EnemyAttackTimelineSnapshot,
  ) {
    this.lastSnapshot = initialSnapshot;
    this.state = createEnemyAttackGaugeState(initialSnapshot);
    // The active combat HUD now renders telegraphs per enemy on the HP bar.
    // Keep this legacy gauge stateful for compatibility, but never render the
    // old global overlay on top of the encounter.
    this.container = scene.add.container(0, 0).setVisible(false);

    this.panel = scene.add
      .rectangle(0, 0, this.panelWidth, this.panelHeight, 0x0b1220, 0.94)
      .setOrigin(0)
      .setStrokeStyle(2, 0x64748b, 0.95);
    this.title = scene.add.text(16, 8, "ENEMY ATTACK // TELEGRAPH", {
      color: "#e2e8f0",
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
    });
    this.activeCount = scene.add.text(0, 8, "", {
      color: "#94a3b8",
      fontFamily: "Galmuri9, monospace",
      fontSize: "12px",
    });
    this.emptyText = scene.add.text(16, 44, "예고 중인 공격 없음", {
      color: "#94a3b8",
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
    });

    this.container.add([
      this.panel,
      this.title,
      this.activeCount,
      this.emptyText,
    ]);
    this.container.setSize(this.panelWidth, this.panelHeight);
    this.refresh();
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setSize(width: number, height: number): void {
    this.panelWidth = Math.max(220, width);
    this.panelHeight = Math.max(112, height);
    this.panel.setSize(this.panelWidth, this.panelHeight);
    this.container.setSize(this.panelWidth, this.panelHeight);
    this.refresh();
  }

  update(snapshot: EnemyAttackTimelineSnapshot): void {
    this.lastSnapshot = snapshot;
    this.state = createEnemyAttackGaugeState(snapshot, this.targetedEnemyId);
    this.refresh();
  }

  setTargetedEnemy(enemyId: string | undefined): void {
    this.targetedEnemyId = enemyId;
    this.state = createEnemyAttackGaugeState(this.lastSnapshot, enemyId);
    this.refresh();
  }

  getState(): EnemyAttackGaugeState {
    return {
      ...this.state,
      attacks: this.state.attacks.map((attack) => ({ ...attack })),
    };
  }

  private refresh(): void {
    const visibleIds = new Set(
      this.state.attacks.map((attack) => attack.timelineId),
    );

    for (const [timelineId, row] of this.rows) {
      if (!visibleIds.has(timelineId)) {
        row.container.destroy();
        this.rows.delete(timelineId);
      }
    }

    this.panel.setSize(this.panelWidth, this.panelHeight);
    this.title.setColor("#e2e8f0");
    this.activeCount
      .setText(this.state.attacks.length + " ACTIVE")
      .setPosition(Math.max(160, this.panelWidth - 92), 8);
    this.emptyText.setVisible(this.state.attacks.length === 0);

    const rowHeight = this.getRowHeight();
    this.state.attacks.forEach((attack, index) => {
      const row = this.rows.get(attack.timelineId) ?? this.createRow(attack);
      row.container.setPosition(0, 29 + index * rowHeight);
      this.refreshRow(row, attack, rowHeight);
    });
  }

  private getRowHeight(): number {
    if (this.state.attacks.length === 0) {
      return 32;
    }

    return Math.max(
      28,
      Math.min(
        42,
        (this.panelHeight - 30) / this.state.attacks.length,
      ),
    );
  }

  private createRow(
    attack: EnemyAttackGaugeAttackState,
  ): EnemyAttackGaugeRow {
    const row = this.createRowObjects();
    this.rows.set(attack.timelineId, row);
    this.container.add(row.container);
    return row;
  }

  private createRowObjects(): EnemyAttackGaugeRow {
    const rowContainer = this.container.scene.add.container(0, 0);
    const rowPanel = this.container.scene.add
      .rectangle(0, 0, 1, 1, 0x111c2d, 0.9)
      .setOrigin(0);
    const icon = this.container.scene.add.text(8, 0, "", {
      color: "#f8fafc",
      fontFamily: "Galmuri9, monospace",
      fontSize: "17px",
    });
    const attackName = this.container.scene.add.text(34, 0, "", {
      color: "#f8fafc",
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
    });
    const type = this.container.scene.add.text(0, 0, "", {
      color: "#cbd5e1",
      fontFamily: "Galmuri9, monospace",
      fontSize: "12px",
    });
    const phase = this.container.scene.add.text(0, 0, "", {
      color: "#cbd5e1",
      fontFamily: "Galmuri9, monospace",
      fontSize: "12px",
    });
    const track = this.container.scene.add
      .rectangle(34, 0, 1, 6, 0x1e293b, 1)
      .setOrigin(0, 0.5);
    const fill = this.container.scene.add
      .rectangle(34, 0, 1, 6, 0xfb7185, 1)
      .setOrigin(0, 0.5);
    const progress = this.container.scene.add.text(0, 0, "", {
      color: "#f8fafc",
      fontFamily: "Galmuri9, monospace",
      fontSize: "11px",
    });

    rowContainer.add([
      rowPanel,
      icon,
      attackName,
      type,
      phase,
      track,
      fill,
      progress,
    ]);

    return {
      container: rowContainer,
      panel: rowPanel,
      icon,
      attackName,
      type,
      phase,
      track,
      fill,
      progress,
    };
  }

  private refreshRow(
    row: EnemyAttackGaugeRow,
    attack: EnemyAttackGaugeAttackState,
    rowHeight: number,
  ): void {
    const bodyHeight = Math.max(24, rowHeight - 3);
    const labelY = Math.max(2, bodyHeight * 0.08);
    const trackY = bodyHeight - 8;
    const trackWidth = ENEMY_ATTACK_GAUGE_TRACK_WIDTH;
    const typeX = Math.max(112, this.panelWidth - 156);
    const phaseX = Math.max(162, this.panelWidth - 82);
    const progressX = Math.max(174, this.panelWidth - 44);

    row.panel
      .setSize(this.panelWidth, bodyHeight)
      .setFillStyle(attack.targeted ? 0x3b2f12 : 0x111c2d, 0.9)
      .setStrokeStyle(
        attack.targeted ? 2 : 1,
        attack.targeted ? 0xffd166 : attack.accent,
        0.9,
      );
    row.container.setAlpha(attack.targeted ? 1 : 0.78);
    row.icon.setPosition(8, labelY).setText(attack.icon).setColor(attack.color);
    row.attackName
      .setPosition(34, labelY)
      .setText(attack.attackName)
      .setColor("#f8fafc");
    row.type
      .setPosition(typeX, labelY)
      .setText(attack.typeLabel)
      .setColor(attack.color);
    row.phase
      .setPosition(phaseX, labelY)
      .setText(attack.phaseLabel)
      .setColor(attack.phase === "windup" ? "#f8fafc" : "#94a3b8");
    row.track.setPosition(34, trackY).setSize(trackWidth, 6);
    row.fill
      .setPosition(34, trackY)
      .setSize(trackWidth * attack.progress, 6)
      .setFillStyle(attack.accent, 1);
    row.progress
      .setPosition(progressX, trackY)
      .setText(Math.round(attack.progress * 100) + "%")
      .setColor(attack.phase === "windup" ? attack.color : "#94a3b8");
  }
}
