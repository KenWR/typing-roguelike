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
}>;

export type EnemyHealthBarOptions = Readonly<{
  shield?: number;
  maxShield?: number;
  targeted?: boolean;
}>;

const ENEMY_HEALTH_BAR_PANEL_WIDTH = 220;
const PANEL_HEIGHT = 40;
export const ENEMY_HEALTH_BAR_TRACK_WIDTH = 190;
const TRACK_HEIGHT = 11;
const TRACK_X = -ENEMY_HEALTH_BAR_TRACK_WIDTH / 2;
const TRACK_Y = -7;

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
  };
};

export class EnemyHealthBar {
  readonly container: Phaser.GameObjects.Container;

  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly shieldFill: Phaser.GameObjects.Rectangle;
  private readonly value: Phaser.GameObjects.Text;
  private state: EnemyHealthBarState;

  constructor(scene: Phaser.Scene, currentHp: number, maxHp: number, options: EnemyHealthBarOptions = {}) {
    this.state = createEnemyHealthBarState(currentHp, maxHp, options);
    this.container = scene.add.container(0, 0);
    this.panel = scene.add
      .rectangle(0, 0, ENEMY_HEALTH_BAR_PANEL_WIDTH, PANEL_HEIGHT, 0x24151c, 0.94)
      .setStrokeStyle(2, 0x64748b, 0.8);
    this.track = scene.add
      .rectangle(TRACK_X, TRACK_Y, ENEMY_HEALTH_BAR_TRACK_WIDTH, TRACK_HEIGHT, 0x0f172a, 0.95)
      .setOrigin(0, 0.5);
    this.hpFill = scene.add.rectangle(TRACK_X, TRACK_Y, 0, TRACK_HEIGHT, 0xe35d6a).setOrigin(0, 0.5);
    this.shieldFill = scene.add
      .rectangle(TRACK_X, TRACK_Y, 0, TRACK_HEIGHT, 0x6ad3f2)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.value = scene.add
      .text(0, 10, "", {
        color: "#f8fafc",
        fontFamily: "Galmuri9, monospace",
        fontSize: "13px",
      })
      .setOrigin(0.5, 0);

    this.container.add([this.panel, this.track, this.hpFill, this.shieldFill, this.value]);
    this.container.setSize(ENEMY_HEALTH_BAR_PANEL_WIDTH, PANEL_HEIGHT);
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

  getState(): EnemyHealthBarState {
    return { ...this.state };
  }

  private refresh(): void {
    const { healthRatio, shieldRatio } = this.state;
    this.hpFill.setSize(ENEMY_HEALTH_BAR_TRACK_WIDTH * healthRatio, TRACK_HEIGHT);
    this.shieldFill
      .setVisible(shieldRatio > 0)
      .setPosition(TRACK_X + ENEMY_HEALTH_BAR_TRACK_WIDTH * healthRatio, TRACK_Y)
      .setSize(ENEMY_HEALTH_BAR_TRACK_WIDTH * shieldRatio, TRACK_HEIGHT);
    this.value.setText(formatEnemyHealthBarLabel(this.state));
    this.panel
      .setStrokeStyle(2, this.state.targeted ? 0xffd166 : 0x64748b, this.state.targeted ? 0.95 : 0.8)
      .setAlpha(this.state.defeated ? 0.58 : 1);
    this.value.setAlpha(this.state.defeated ? 0.62 : 1);
  }
}
