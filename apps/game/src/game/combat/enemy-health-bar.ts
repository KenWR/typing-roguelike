import type Phaser from "phaser";

export type EnemyHealthBarState = Readonly<{
  currentHp: number;
  maxHp: number;
  healthRatio: number;
  shield: number;
  maxShield: number;
  shieldRatio: number;
  targeted: boolean;
  defeated: boolean;
  telegraphAttackName: string;
  telegraphAttackType: "attack" | "defense" | "buff" | "debuff" | null;
  telegraphProgress: number;
}>;

export type EnemyHealthBarOptions = Readonly<{
  shield?: number;
  maxShield?: number;
  targeted?: boolean;
}>;

export const ENEMY_HEALTH_BAR_PANEL_WIDTH = 220;
export const ENEMY_HEALTH_BAR_REGION_TOP = -38;
export const ENEMY_HEALTH_BAR_REGION_BOTTOM = 34;
export const ENEMY_HEALTH_BAR_TRACK_WIDTH = 190;
export const ENEMY_HEALTH_BAR_TRACK_Y = -7;
export const ENEMY_TELEGRAPH_TRACK_Y = 7;
const TRACK_HEIGHT = 11;
const TRACK_X = -ENEMY_HEALTH_BAR_TRACK_WIDTH / 2;

const clamp = (value: number, maximum: number): number => Math.min(Math.max(0, value), Math.max(0, maximum));

export const formatEnemyHealthBarLabel = (
  state: Pick<EnemyHealthBarState, "currentHp" | "maxHp" | "shield" | "maxShield">,
): string => `HP ${state.currentHp}/${state.maxHp}   SHD ${state.shield}/${state.maxShield}`;

const safeNumber = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const createEnemyHealthBarState = (
  currentHp: number | undefined,
  maxHp: number | undefined,
  options: EnemyHealthBarOptions = {},
): EnemyHealthBarState => {
  const safeMaxHp = Math.max(0, safeNumber(maxHp, 0));
  const safeCurrentHp = clamp(safeNumber(currentHp, 0), safeMaxHp);
  const requestedShield = Math.max(0, Math.round(safeNumber(options.shield, 0)));
  const maxShield = Math.max(0, Math.round(safeNumber(options.maxShield, requestedShield)));
  const shield = Math.min(requestedShield, maxShield);
  // HP and shield share one track. When their sum is greater than the
  // configured HP capacity, scale both values against the combined total so
  // the shield fill never extends beyond the track.
  const barTotal = Math.max(safeMaxHp, safeCurrentHp + shield);
  const healthRatio = barTotal > 0 ? safeCurrentHp / barTotal : 0;

  return {
    currentHp: safeCurrentHp,
    maxHp: safeMaxHp,
    healthRatio,
    shield,
    maxShield,
    shieldRatio: barTotal > 0 ? shield / barTotal : 0,
    targeted: options.targeted === true,
    defeated: safeCurrentHp <= 0,
    telegraphAttackName: "",
    telegraphAttackType: null,
    telegraphProgress: 0,
  };
};

export class EnemyHealthBar {
  readonly container: Phaser.GameObjects.Container;

  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly shieldFill: Phaser.GameObjects.Rectangle;
  private readonly telegraphTrack: Phaser.GameObjects.Rectangle;
  private readonly telegraphFill: Phaser.GameObjects.Rectangle;
  private readonly telegraphName: Phaser.GameObjects.Text;
  private readonly value: Phaser.GameObjects.Text;
  private state: EnemyHealthBarState;

  constructor(scene: Phaser.Scene, currentHp: number, maxHp: number, options: EnemyHealthBarOptions = {}) {
    this.state = createEnemyHealthBarState(currentHp, maxHp, options);
    this.container = scene.add.container(0, 0);
    this.panel = scene.add
      // Keep the area around the bars transparent; only the bar tracks and
      // text should remain visible near the monster.
      .rectangle(
        0,
        0,
        ENEMY_HEALTH_BAR_PANEL_WIDTH,
        ENEMY_HEALTH_BAR_REGION_BOTTOM - ENEMY_HEALTH_BAR_REGION_TOP,
        0,
        0,
      );
    this.telegraphTrack = scene.add
      .rectangle(TRACK_X, ENEMY_TELEGRAPH_TRACK_Y, ENEMY_HEALTH_BAR_TRACK_WIDTH, 6, 0x0f172a, 0.95)
      .setOrigin(0, 0.5);
    this.telegraphFill = scene.add.rectangle(TRACK_X, ENEMY_TELEGRAPH_TRACK_Y, 0, 6, 0xef4444, 1).setOrigin(0, 0.5);
    this.telegraphName = scene.add
      .text(0, ENEMY_HEALTH_BAR_REGION_TOP + 2, "", {
        color: "#f8fafc",
        fontFamily: "Galmuri9, monospace",
        fontSize: "13px",
        align: "center",
        wordWrap: { width: ENEMY_HEALTH_BAR_PANEL_WIDTH - 12 },
      })
      .setOrigin(0.5, 0);
    this.track = scene.add
      .rectangle(TRACK_X, ENEMY_HEALTH_BAR_TRACK_Y, ENEMY_HEALTH_BAR_TRACK_WIDTH, TRACK_HEIGHT, 0x0f172a, 0.95)
      .setOrigin(0, 0.5);
    this.hpFill = scene.add.rectangle(TRACK_X, ENEMY_HEALTH_BAR_TRACK_Y, 0, TRACK_HEIGHT, 0xe35d6a).setOrigin(0, 0.5);
    this.shieldFill = scene.add
      .rectangle(TRACK_X, ENEMY_HEALTH_BAR_TRACK_Y, 0, TRACK_HEIGHT, 0x6ad3f2)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.value = scene.add
      .text(0, 19, "", {
        color: "#f8fafc",
        fontFamily: "Galmuri9, monospace",
        fontSize: "13px",
      })
      .setOrigin(0.5, 0);

    this.container.add([
      this.panel,
      this.telegraphTrack,
      this.telegraphFill,
      this.telegraphName,
      this.track,
      this.hpFill,
      this.shieldFill,
      this.value,
    ]);
    this.container.setSize(ENEMY_HEALTH_BAR_PANEL_WIDTH, ENEMY_HEALTH_BAR_REGION_BOTTOM - ENEMY_HEALTH_BAR_REGION_TOP);
    this.refresh();
  }

  update(currentHp: number, maxHp: number, options: EnemyHealthBarOptions = {}): void {
    this.state = createEnemyHealthBarState(currentHp, maxHp, options);
    this.refresh();
  }

  setTargeted(targeted: boolean): void {
    if (this.state.targeted === targeted) return;
    this.state = { ...this.state, targeted };
    this.refresh();
  }

  updateTelegraph(
    attackName: string | undefined,
    attackType: EnemyHealthBarState["telegraphAttackType"],
    progress: number,
  ): void {
    const safeProgress = Math.min(Math.max(0, Number.isFinite(progress) ? progress : 0), 1);
    this.state = {
      ...this.state,
      telegraphAttackName: attackName?.trim() ?? "",
      telegraphAttackType: attackType,
      telegraphProgress: safeProgress,
    };
    this.refresh();
  }

  getState(): EnemyHealthBarState {
    return { ...this.state };
  }

  private refresh(): void {
    const { healthRatio, shieldRatio } = this.state;
    const telegraphColor = this.state.telegraphAttackType === "defense" ? 0x60a5fa : 0xef4444;
    this.hpFill.setSize(ENEMY_HEALTH_BAR_TRACK_WIDTH * healthRatio, TRACK_HEIGHT);
    this.telegraphFill
      .setSize(ENEMY_HEALTH_BAR_TRACK_WIDTH * this.state.telegraphProgress, 6)
      .setFillStyle(telegraphColor, 1);
    this.telegraphTrack.setVisible(this.state.telegraphAttackName.length > 0);
    this.telegraphFill.setVisible(this.state.telegraphAttackName.length > 0);
    this.telegraphName.setText(this.state.telegraphAttackName).setVisible(this.state.telegraphAttackName.length > 0);
    this.shieldFill
      .setVisible(shieldRatio > 0)
      .setPosition(TRACK_X + ENEMY_HEALTH_BAR_TRACK_WIDTH * healthRatio, ENEMY_HEALTH_BAR_TRACK_Y)
      .setSize(ENEMY_HEALTH_BAR_TRACK_WIDTH * shieldRatio, TRACK_HEIGHT);
    this.value.setText(formatEnemyHealthBarLabel(this.state));
    this.panel.setAlpha(0);
    this.value.setAlpha(this.state.defeated ? 0.62 : 1);
  }
}
