import Phaser from "phaser";

export type CombatHudState = {
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
};

export type CombatHudUpdate = Partial<Pick<CombatHudState, "hp" | "ap">>;

const clamp = (value: number, maximum: number) =>
  Math.min(Math.max(0, value), Math.max(0, maximum));

export function formatCombatHudResourceValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function createCombatHudState(state: CombatHudState): CombatHudState {
  return {
    hp: clamp(state.hp, state.maxHp),
    maxHp: Math.max(0, state.maxHp),
    ap: clamp(state.ap, state.maxAp),
    maxAp: Math.max(0, state.maxAp),
  };
}

export function updateCombatHudState(
  state: CombatHudState,
  update: CombatHudUpdate,
): CombatHudState {
  return {
    ...state,
    hp: update.hp === undefined ? state.hp : clamp(update.hp, state.maxHp),
    ap: update.ap === undefined ? state.ap : clamp(update.ap, state.maxAp),
  };
}

export class CombatHud {
  readonly container: Phaser.GameObjects.Container;
  private readonly hpValue: Phaser.GameObjects.Text;
  private readonly apValue: Phaser.GameObjects.Text;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly apFill: Phaser.GameObjects.Rectangle;
  private state: CombatHudState;
  private barWidth = 120;

  constructor(scene: Phaser.Scene, initialState: CombatHudState) {
    this.state = createCombatHudState(initialState);
    this.container = scene.add.container(0, 0);

    const panel = scene.add
      .rectangle(0, 0, 1, 1, 0x0b1220, 0.9)
      .setOrigin(0)
      .setStrokeStyle(2, 0x64748b, 0.8);
    const title = scene.add.text(18, 10, "PLAYER STATUS", {
      color: "#e2e8f0",
      fontFamily: "Galmuri9, monospace",
      fontSize: "14px",
    });
    const hpLabel = scene.add.text(18, 38, "HP", this.labelStyle());
    const apLabel = scene.add.text(18, 76, "AP", this.labelStyle());
    this.hpFill = scene.add.rectangle(60, 47, 1, 12, 0xe35d6a).setOrigin(0, 0.5);
    this.apFill = scene.add.rectangle(60, 85, 1, 12, 0x4f9ee8).setOrigin(0, 0.5);
    this.hpValue = scene.add.text(0, 30, "", this.valueStyle()).setOrigin(1, 0);
    this.apValue = scene.add.text(0, 68, "", this.valueStyle()).setOrigin(1, 0);
    this.container.add([panel, title, hpLabel, apLabel, this.hpFill, this.apFill, this.hpValue, this.apValue]);
    this.container.setSize(280, 112);
    this.refresh(this.barWidth);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setSize(width: number, height: number): void {
    const panel = this.container.list[0] as Phaser.GameObjects.Rectangle;
    panel.setSize(width, height);
    this.container.setSize(width, height);
    this.barWidth = Math.max(110, width - 160);
    this.refresh(this.barWidth);
  }

  update(update: CombatHudUpdate): void {
    this.state = updateCombatHudState(this.state, update);
    this.refresh(this.barWidth);
  }

  getState(): CombatHudState {
    return { ...this.state };
  }

  private refresh(barWidth: number): void {
    const valueRight = barWidth + 142;
    this.hpValue
      .setText(`${formatCombatHudResourceValue(this.state.hp)} / ${formatCombatHudResourceValue(this.state.maxHp)}`)
      .setPosition(valueRight, 30);
    this.apValue
      .setText(`${formatCombatHudResourceValue(this.state.ap)} / ${formatCombatHudResourceValue(this.state.maxAp)}`)
      .setPosition(valueRight, 68);
    this.hpFill.setSize(barWidth * (this.state.maxHp ? this.state.hp / this.state.maxHp : 0), 12);
    this.apFill.setSize(barWidth * (this.state.maxAp ? this.state.ap / this.state.maxAp : 0), 12);
  }

  private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { color: "#f8fafc", fontFamily: "Galmuri9, monospace", fontSize: "16px" };
  }

  private valueStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { color: "#f8fafc", fontFamily: "Galmuri9, monospace", fontSize: "14px" };
  }
}
