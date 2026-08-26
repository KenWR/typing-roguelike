import type Phaser from "phaser";
import {
  EFFECT_PLACEHOLDER_TEXTURE_KEY,
  formatEffectRemainingTime,
  getEffectDarknessRatio,
  type EffectPresentation,
} from "./effect-presentation";

const ICON_SIZE = 28;
const ICON_GAP = 5;
const TOOLTIP_OFFSET = 18;

type EffectVisual = {
  container: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  darkness: Phaser.GameObjects.Rectangle;
  stackText: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  effect: EffectPresentation;
};

export class ActorEffectHud {
  readonly container: Phaser.GameObjects.Container;
  private readonly visuals = new Map<string, EffectVisual>();
  private readonly tooltip: Phaser.GameObjects.Text;
  private hoveredId?: string;

  constructor(private readonly scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
    this.tooltip = scene.add
      .text(0, 0, "", {
        fontFamily: "Galmuri9, monospace",
        fontSize: "12px",
        color: "#f8fafc",
        backgroundColor: "#111827",
        padding: { x: 9, y: 7 },
        wordWrap: { width: 260 },
      })
      .setDepth(2_000)
      .setVisible(false);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  update(effects: readonly EffectPresentation[]): void {
    const activeIds = new Set(effects.map((effect) => effect.id));
    for (const [id, visual] of this.visuals) {
      if (!activeIds.has(id)) {
        if (this.hoveredId === id) this.hideTooltip();
        visual.container.destroy(true);
        this.visuals.delete(id);
      }
    }

    effects.forEach((effect) => {
      const existing = this.visuals.get(effect.id);
      if (existing === undefined) {
        this.visuals.set(effect.id, this.createVisual(effect));
      } else {
        existing.effect = effect;
        const textureKey = this.scene.textures.exists(effect.textureKey)
          ? effect.textureKey
          : EFFECT_PLACEHOLDER_TEXTURE_KEY;
        if (existing.icon.texture.key !== textureKey && this.scene.textures.exists(textureKey)) {
          existing.icon.setTexture(textureKey);
        }
        this.updateVisual(existing);
      }
    });

    const ordered = effects
      .map((effect) => this.visuals.get(effect.id))
      .filter((visual): visual is EffectVisual => visual !== undefined);
    const totalWidth = ordered.length === 0
      ? 0
      : ordered.length * ICON_SIZE + (ordered.length - 1) * ICON_GAP;
    ordered.forEach((visual, index) => {
      visual.container.setPosition(
        -totalWidth / 2 + ICON_SIZE / 2 + index * (ICON_SIZE + ICON_GAP),
        0,
      );
    });
    this.container.setVisible(ordered.length > 0);
  }

  destroy(): void {
    this.hideTooltip();
    this.tooltip.destroy();
    this.container.destroy(true);
    this.visuals.clear();
  }

  private createVisual(effect: EffectPresentation): EffectVisual {
    const slot = this.scene.add.container(0, 0);
    const frame = this.scene.add
      .rectangle(0, 0, ICON_SIZE, ICON_SIZE, 0x111827, 0.88)
      .setStrokeStyle(1, 0x94a3b8, 0.8);
    const textureKey = this.scene.textures.exists(effect.textureKey)
      ? effect.textureKey
      : EFFECT_PLACEHOLDER_TEXTURE_KEY;
    const icon = this.scene.add.image(0, 0, textureKey).setDisplaySize(ICON_SIZE - 4, ICON_SIZE - 4);
    const darkness = this.scene.add.rectangle(0, ICON_SIZE / 2, ICON_SIZE - 2, 0, 0x020617, 0.68);
    const stackText = this.scene.add
      .text(ICON_SIZE / 2 - 2, ICON_SIZE / 2 - 1, "", {
        fontFamily: "Galmuri9, monospace",
        fontSize: "10px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(1, 1);
    const hitArea = this.scene.add.zone(0, 0, ICON_SIZE, ICON_SIZE).setInteractive({ useHandCursor: true });
    slot.add([frame, icon, darkness, stackText, hitArea]);
    this.container.add(slot);

    const visual: EffectVisual = { container: slot, icon, darkness, stackText, hitArea, effect };
    hitArea.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      this.hoveredId = effect.id;
      this.showTooltip(visual.effect, pointer);
    });
    hitArea.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.hoveredId === effect.id) this.positionTooltip(pointer);
    });
    hitArea.on("pointerout", () => {
      if (this.hoveredId === effect.id) this.hideTooltip();
    });
    this.updateVisual(visual);
    return visual;
  }

  private updateVisual(visual: EffectVisual): void {
    const ratio = getEffectDarknessRatio(visual.effect);
    const height = (ICON_SIZE - 2) * ratio;
    visual.darkness
      .setSize(ICON_SIZE - 2, height)
      .setPosition(0, ICON_SIZE / 2 - 1 - height / 2)
      .setVisible(height > 0);
    visual.stackText.setText(visual.effect.stacks > 1 ? String(visual.effect.stacks) : "");
    if (this.hoveredId === visual.effect.id) {
      this.tooltip.setText(this.tooltipText(visual.effect));
    }
  }

  private showTooltip(effect: EffectPresentation, pointer: Phaser.Input.Pointer): void {
    this.tooltip.setText(this.tooltipText(effect)).setVisible(true);
    this.positionTooltip(pointer);
  }

  private positionTooltip(pointer: Phaser.Input.Pointer): void {
    const width = this.scene.scale.gameSize.width;
    const height = this.scene.scale.gameSize.height;
    const bounds = this.tooltip.getBounds();
    const x = Math.min(pointer.x + TOOLTIP_OFFSET, Math.max(6, width - bounds.width - 6));
    const y = Math.min(pointer.y + TOOLTIP_OFFSET, Math.max(6, height - bounds.height - 6));
    this.tooltip.setPosition(Math.max(6, x), Math.max(6, y));
  }

  private hideTooltip(): void {
    this.hoveredId = undefined;
    this.tooltip.setVisible(false);
  }

  private tooltipText(effect: EffectPresentation): string {
    const stack = effect.stacks > 1 ? `\n중첩: ${effect.stacks}` : "";
    return `${effect.name}\n${effect.description}\n${formatEffectRemainingTime(effect.remainingMs)}${stack}`;
  }
}
