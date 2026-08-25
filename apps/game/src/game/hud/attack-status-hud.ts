import Phaser from "phaser";
import type {
  EnemyAttackPhase,
  EnemyAttackSnapshot,
  EnemyAttackTimelineSnapshot,
} from "../combat/enemy-attack-timeline";

export type AttackStatusPhase = Exclude<EnemyAttackPhase, "resolved">;
export type AttackStatusKind = "cast" | "impact";
export type AttackStatusLabel = "시전 게이지" | "타격 대기";

export type AttackStatusHudEntry = Readonly<{
  timelineId: string;
  enemyId: string;
  targetId: string;
  attackId: string;
  attackName: string;
  attackType: EnemyAttackSnapshot["attackType"];
  phase: AttackStatusPhase;
  kind: AttackStatusKind;
  label: AttackStatusLabel;
  phaseElapsedMs: number;
  phaseDurationMs: number;
  progress: number;
  remainingMs: number;
  castCompleted: boolean;
  impactResolved: false;
}>;

export type AttackStatusHudState = Readonly<{
  status: EnemyAttackTimelineSnapshot["status"];
  elapsedMs: number;
  attacks: readonly AttackStatusHudEntry[];
}>;

type AttackStatusHudRow = Readonly<{
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  badge: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  remaining: Phaser.GameObjects.Text;
  progressTrack: Phaser.GameObjects.Rectangle;
  progressFill: Phaser.GameObjects.Rectangle;
}>;

type AttackStatusPresentation = Readonly<{
  accent: number;
  color: string;
}>;

const PRESENTATION_BY_KIND: Record<
  AttackStatusKind,
  AttackStatusPresentation
> = {
  cast: { accent: 0xf59e0b, color: "#fbbf24" },
  impact: { accent: 0xe11d48, color: "#fb7185" },
};

const DEFAULT_WIDTH = 440;
const DEFAULT_HEIGHT = 128;
const ROW_HEIGHT = 68;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const toHudEntry = (
  attack: EnemyAttackSnapshot,
): AttackStatusHudEntry | null => {
  if (attack.impactResolved || attack.phase === "resolved") {
    return null;
  }

  const phase: AttackStatusPhase = attack.phase;
  const kind: AttackStatusKind = phase === "windup" ? "cast" : "impact";
  const phaseDurationMs = Math.max(0, attack.phaseDurationMs);
  const phaseElapsedMs = clamp(
    attack.phaseElapsedMs,
    0,
    phaseDurationMs,
  );

  return {
    timelineId: attack.timelineId,
    enemyId: attack.enemyId,
    targetId: attack.targetId,
    attackId: attack.attackId,
    attackName: attack.attackName,
    attackType: attack.attackType,
    phase,
    kind,
    label: kind === "cast" ? "시전 게이지" : "타격 대기",
    phaseElapsedMs,
    phaseDurationMs,
    progress: clamp(attack.phaseProgress, 0, 1),
    remainingMs: Math.max(0, phaseDurationMs - phaseElapsedMs),
    castCompleted: attack.castCompleted,
    impactResolved: false,
  };
};

export function createAttackStatusHudState(
  snapshot: EnemyAttackTimelineSnapshot,
): AttackStatusHudState {
  return {
    status: snapshot.status,
    elapsedMs: snapshot.elapsedMs,
    attacks: snapshot.attacks.flatMap((attack) => {
      const entry = toHudEntry(attack);
      return entry === null ? [] : [entry];
    }),
  };
}

export function updateAttackStatusHudState(
  _state: AttackStatusHudState,
  snapshot: EnemyAttackTimelineSnapshot,
): AttackStatusHudState {
  return createAttackStatusHudState(snapshot);
}

export class AttackStatusHud {
  readonly container: Phaser.GameObjects.Container;

  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly emptyText: Phaser.GameObjects.Text;
  private readonly rows: AttackStatusHudRow[] = [];
  private state: AttackStatusHudState;
  private panelWidth = DEFAULT_WIDTH;
  private panelHeight = DEFAULT_HEIGHT;

  constructor(
    scene: Phaser.Scene,
    initialSnapshot: EnemyAttackTimelineSnapshot,
  ) {
    this.state = createAttackStatusHudState(initialSnapshot);
    this.container = scene.add.container(0, 0);
    this.panel = scene.add
      .rectangle(0, 0, this.panelWidth, this.panelHeight, 0x0b1220, 0.95)
      .setOrigin(0)
      .setStrokeStyle(2, 0x64748b, 0.95);
    this.title = scene.add.text(18, 12, "ENEMY ATTACK STATUS", {
      color: "#94a3b8",
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
    });
    this.emptyText = scene.add.text(18, 48, "현재 타격 대기 없음", {
      color: "#64748b",
      fontFamily: "Galmuri9, monospace",
      fontSize: "14px",
    });

    this.container.add([this.panel, this.title, this.emptyText]);
    this.container.setSize(this.panelWidth, this.panelHeight);
    this.refresh();
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setSize(width: number, height: number): void {
    this.panelWidth = Math.max(260, width);
    this.panelHeight = Math.max(DEFAULT_HEIGHT, height);
    this.panel.setSize(this.panelWidth, this.panelHeight);
    this.container.setSize(this.panelWidth, this.panelHeight);
    this.refresh();
  }

  update(snapshot: EnemyAttackTimelineSnapshot): void {
    this.state = updateAttackStatusHudState(this.state, snapshot);
    this.refresh();
  }

  getState(): AttackStatusHudState {
    return {
      ...this.state,
      attacks: this.state.attacks.map((attack) => ({ ...attack })),
    };
  }

  private refresh(): void {
    const rowWidth = Math.max(224, this.panelWidth - 36);
    const visibleRows = this.state.attacks.length;
    const requiredHeight = 48 + visibleRows * ROW_HEIGHT;

    this.panel.setSize(this.panelWidth, Math.max(this.panelHeight, requiredHeight));
    this.container.setSize(
      this.panelWidth,
      Math.max(this.panelHeight, requiredHeight),
    );
    this.emptyText.setVisible(visibleRows === 0);

    for (let index = 0; index < this.state.attacks.length; index += 1) {
      const row = this.getOrCreateRow(index);
      const attack = this.state.attacks[index];
      const presentation = PRESENTATION_BY_KIND[attack.kind];
      const progressWidth = rowWidth - 24;

      row.container
        .setPosition(18, 36 + index * ROW_HEIGHT)
        .setVisible(true)
        .setActive(true);
      row.background
        .setSize(rowWidth, ROW_HEIGHT - 8)
        .setStrokeStyle(1, presentation.accent, 0.85);
      row.badge.setText(attack.label).setColor(presentation.color);
      row.name.setText(attack.attackName).setColor("#f8fafc");
      row.remaining
        .setPosition(rowWidth - 12, 29)
        .setText(`${Math.ceil(attack.remainingMs)}ms 남음`)
        .setColor(presentation.color);
      row.progressTrack.setSize(progressWidth, 8);
      row.progressFill
        .setSize(progressWidth * attack.progress, 8)
        .setFillStyle(presentation.accent, 1);
    }

    for (let index = this.state.attacks.length; index < this.rows.length; index += 1) {
      this.rows[index].container.setVisible(false).setActive(false);
    }
  }

  private getOrCreateRow(index: number): AttackStatusHudRow {
    const existing = this.rows[index];
    if (existing !== undefined) {
      return existing;
    }

    const rowContainer = this.container.scene.add.container(0, 0);
    const background = this.container.scene.add
      .rectangle(0, 0, 1, ROW_HEIGHT - 8, 0x111827, 0.9)
      .setOrigin(0);
    const badge = this.container.scene.add.text(12, 9, "", {
      color: "#cbd5e1",
      fontFamily: "Galmuri9, monospace",
      fontSize: "11px",
    });
    const name = this.container.scene.add.text(12, 29, "", {
      color: "#f8fafc",
      fontFamily: "Galmuri9, monospace",
      fontSize: "15px",
    });
    const remaining = this.container.scene.add.text(0, 29, "", {
      color: "#cbd5e1",
      fontFamily: "Galmuri9, monospace",
      fontSize: "11px",
    }).setOrigin(1, 0);
    const progressTrack = this.container.scene.add
      .rectangle(12, 52, 1, 8, 0x1e293b, 1)
      .setOrigin(0, 0.5);
    const progressFill = this.container.scene.add
      .rectangle(12, 52, 1, 8, 0x64748b, 1)
      .setOrigin(0, 0.5);

    rowContainer.add([
      background,
      badge,
      name,
      remaining,
      progressTrack,
      progressFill,
    ]);
    this.container.add(rowContainer);

    const row: AttackStatusHudRow = {
      container: rowContainer,
      background,
      badge,
      name,
      remaining,
      progressTrack,
      progressFill,
    };
    this.rows.push(row);
    return row;
  }
}
