import Phaser from "phaser";
import {
  TEXTURE_KEYS,
} from "../assets/asset-catalog";
import {
  createRelicHudEntries,
  type RelicHudEntry,
} from "./relic-hud-view";

const RARITY_LABELS: Record<RelicHudEntry["rarity"], string> = {
  common: "일반",
  uncommon: "고급",
  rare: "희귀",
  epic: "영웅",
  legendary: "전설",
  hidden: "숨김",
};

const RARITY_COLORS: Record<RelicHudEntry["rarity"], number> = {
  common: 0x94a3b8,
  uncommon: 0x2dd4bf,
  rare: 0x60a5fa,
  epic: 0xa78bfa,
  legendary: 0xfbbf24,
  hidden: 0xf472b6,
};

type RelicIconView = Readonly<{
  entry: RelicHudEntry;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
}>;

export class RelicHud {
  readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly emptyText: Phaser.GameObjects.Text;
  private readonly icons: readonly RelicIconView[];
  private readonly overflowFrame: Phaser.GameObjects.Rectangle;
  private readonly overflowText: Phaser.GameObjects.Text;
  private readonly tooltip: Phaser.GameObjects.Container;
  private readonly tooltipPanel: Phaser.GameObjects.Rectangle;
  private readonly tooltipName: Phaser.GameObjects.Text;
  private readonly tooltipMeta: Phaser.GameObjects.Text;
  private readonly tooltipDescription: Phaser.GameObjects.Text;
  private width = 320;
  private height = 48;

  constructor(scene: Phaser.Scene, relicIds: readonly string[]) {
    const entries = createRelicHudEntries(relicIds);
    this.container = scene.add.container(0, 0);
    this.panel = scene.add
      .rectangle(0, 0, 1, 1, 0x0b1220, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0x475569, 0.9);
    this.title = scene.add.text(12, 0, `RELICS ${entries.length}`, {
      color: "#e2e8f0",
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
      fontStyle: "bold",
    });
    this.emptyText = scene.add.text(98, 0, "보유 유물 없음", {
      color: "#64748b",
      fontFamily: "Galmuri9, monospace",
      fontSize: "12px",
    }).setVisible(entries.length === 0);

    this.icons = entries.map((entry) => {
      const container = scene.add.container(0, 0);
      const frame = scene.add
        .rectangle(0, 0, 36, 36, 0x172033, 1)
        .setOrigin(0)
        .setStrokeStyle(2, RARITY_COLORS[entry.rarity], 0.9)
        .setInteractive({ useHandCursor: true });
      const textureKey = scene.textures.exists(entry.textureKey)
        ? entry.textureKey
        : TEXTURE_KEYS.missingAsset;
      const image = scene.add.image(18, 18, textureKey).setDisplaySize(32, 32);
      frame.on(Phaser.Input.Events.POINTER_OVER, () => {
        frame.setStrokeStyle(3, 0xf8fafc, 1);
        this.showTooltip(entry, container.x);
      });
      frame.on(Phaser.Input.Events.POINTER_OUT, () => {
        frame.setStrokeStyle(2, RARITY_COLORS[entry.rarity], 0.9);
        this.tooltip.setVisible(false);
      });
      container.add([frame, image]);
      return { entry, container, frame };
    });

    this.overflowFrame = scene.add
      .rectangle(0, 0, 36, 36, 0x1e293b, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0x64748b, 1)
      .setVisible(false);
    this.overflowText = scene.add.text(0, 0, "", {
      color: "#cbd5e1",
      fontFamily: "Galmuri9, monospace",
      fontSize: "11px",
      fontStyle: "bold",
    }).setOrigin(0.5).setVisible(false);

    this.tooltip = scene.add.container(0, 0).setVisible(false);
    this.tooltipPanel = scene.add
      .rectangle(0, 0, 300, 112, 0x050b14, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, 0x94a3b8, 1);
    this.tooltipName = scene.add.text(14, 12, "", {
      color: "#f8fafc",
      fontFamily: "Galmuri9, monospace",
      fontSize: "15px",
      fontStyle: "bold",
    });
    this.tooltipMeta = scene.add.text(14, 36, "", {
      color: "#94a3b8",
      fontFamily: "Galmuri9, monospace",
      fontSize: "11px",
    });
    this.tooltipDescription = scene.add.text(14, 58, "", {
      color: "#dbeafe",
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
      lineSpacing: 4,
      wordWrap: { width: 272 },
    });
    this.tooltip.add([
      this.tooltipPanel,
      this.tooltipName,
      this.tooltipMeta,
      this.tooltipDescription,
    ]);

    this.container.add([
      this.panel,
      this.title,
      this.emptyText,
      ...this.icons.map((icon) => icon.container),
      this.overflowFrame,
      this.overflowText,
      this.tooltip,
    ]);
    this.setSize(this.width, this.height);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setSize(width: number, height: number, trailingSpace = 0): void {
    this.width = width;
    this.height = height;
    this.panel.setSize(width, height);
    this.container.setSize(width, height);
    this.title.setPosition(12, Math.max(0, (height - this.title.height) / 2));
    this.emptyText.setPosition(98, Math.max(0, (height - this.emptyText.height) / 2));

    const iconSize = 36;
    const gap = 6;
    const startX = 96;
    const iconY = Math.max(0, (height - iconSize) / 2);
    const availableWidth = Math.max(0, width - startX - 12 - trailingSpace);
    const slotCount = Math.max(0, Math.floor((availableWidth + gap) / (iconSize + gap)));
    const needsOverflow = this.icons.length > slotCount;
    const visibleCount = needsOverflow ? Math.max(0, slotCount - 1) : this.icons.length;

    this.icons.forEach((icon, index) => {
      icon.container
        .setPosition(startX + index * (iconSize + gap), iconY)
        .setVisible(index < visibleCount);
    });

    const hiddenCount = this.icons.length - visibleCount;
    this.overflowFrame
      .setPosition(startX + visibleCount * (iconSize + gap), iconY)
      .setVisible(needsOverflow && slotCount > 0);
    this.overflowText
      .setPosition(
        startX + visibleCount * (iconSize + gap) + iconSize / 2,
        iconY + iconSize / 2,
      )
      .setText(`+${hiddenCount}`)
      .setVisible(needsOverflow && slotCount > 0);
  }

  private showTooltip(entry: RelicHudEntry, iconX: number): void {
    this.tooltipName.setText(entry.name);
    this.tooltipMeta
      .setText(`${RARITY_LABELS[entry.rarity]} · ${entry.id}`)
      .setColor(Phaser.Display.Color.IntegerToColor(RARITY_COLORS[entry.rarity]).rgba);
    this.tooltipDescription.setText(entry.description);
    const tooltipHeight = Math.max(102, this.tooltipDescription.y + this.tooltipDescription.height + 14);
    this.tooltipPanel
      .setSize(300, tooltipHeight)
      .setStrokeStyle(2, RARITY_COLORS[entry.rarity], 1);
    this.tooltip
      .setPosition(Math.min(Math.max(0, iconX), Math.max(0, this.width - 300)), this.height + 8)
      .setVisible(true);
  }
}
