import Phaser from "phaser";
import {
  EQUIPMENT_BY_ID,
  type CombatLoadoutMode,
  type CombatLoadoutOption,
  type Rarity,
  type RunState,
} from "@typing-roguelike/shared";
import { getRelicIconTextureKey } from "../assets/asset-catalog";
import { resolveEquipmentIconTextureKey } from "../assets/equipment-icon-assets";
import { resolveRingIconTextureKey } from "../assets/ring-icon-assets";
import { clampInventoryModalScroll, createInventoryModalLayout } from "./inventory-modal-state";
import { createInventoryBagIcon } from "./inventory-icons";
import {
  createInventoryView,
  type InventoryEquipmentSlot,
  type InventoryEquipmentView,
  type InventoryRelicView,
} from "./inventory-view";

const FONT_FAMILY = "Galmuri9, 'Apple SD Gothic Neo', monospace";

const RARITY_LABELS: Readonly<Record<Rarity, string>> = {
  common: "일반",
  uncommon: "고급",
  rare: "희귀",
  epic: "영웅",
  legendary: "전설",
  hidden: "숨김",
};

const RARITY_COLORS: Readonly<Record<Rarity, number>> = {
  common: 0x94a3b8,
  uncommon: 0x2dd4bf,
  rare: 0x60a5fa,
  epic: 0xa78bfa,
  legendary: 0xfbbf24,
  hidden: 0xf472b6,
};

const SLOT_LABELS: Readonly<Record<InventoryEquipmentSlot, string>> = {
  weapon: "무기",
  subweapon: "보조무기",
  unknown: "슬롯 정보 없음",
};

type InventoryModalCloseHandler = () => void;

export type InventoryModalOptions = Readonly<{
  combatLoadout?: Readonly<{
    options: readonly CombatLoadoutOption[];
    onSelect: (mode: CombatLoadoutMode) => void;
  }>;
}>;

export class InventoryModal {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly view: ReturnType<typeof createInventoryView>;
  private readonly onClose: InventoryModalCloseHandler;
  private readonly combatLoadout?: InventoryModalOptions["combatLoadout"];
  private readonly blocker: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly contentBackdrop: Phaser.GameObjects.Rectangle;
  private readonly contentRoot: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly contentMask: Phaser.Display.Masks.GeometryMask;
  private readonly titleIcon: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Text;
  private readonly footer: Phaser.GameObjects.Text;
  private readonly scrollTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollThumb: Phaser.GameObjects.Rectangle;
  private contentX = 0;
  private contentY = 0;
  private contentHeight = 1;
  private scrollbarX = 0;
  private maxScroll = 0;
  private scrollOffset = 0;

  constructor(
    scene: Phaser.Scene,
    runState: Readonly<RunState>,
    onClose: InventoryModalCloseHandler,
    options: InventoryModalOptions = {},
  ) {
    this.scene = scene;
    this.view = createInventoryView(runState);
    this.onClose = onClose;
    this.combatLoadout = options.combatLoadout;

    const width = Math.max(1, scene.scale.gameSize.width || scene.scale.width);
    const height = Math.max(1, scene.scale.gameSize.height || scene.scale.height);

    this.container = scene.add.container(0, 0).setDepth(1000);
    this.blocker = scene.add.rectangle(width / 2, height / 2, width, height, 0x020611, 0.72).setInteractive();
    this.blocker.on(
      Phaser.Input.Events.POINTER_DOWN,
      (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) =>
        event.stopPropagation(),
    );

    this.panel = scene.add.rectangle(0, 0, 1, 1, 0x0b1220, 0.98).setOrigin(0).setStrokeStyle(2, 0x64748b, 1);
    this.contentBackdrop = scene.add
      .rectangle(0, 0, 1, 1, 0x07101d, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0x334155, 0.95);
    this.contentRoot = scene.add.container(0, 0);
    this.maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
    this.contentMask = this.maskShape.createGeometryMask();
    this.contentRoot.setMask(this.contentMask);

    this.titleIcon = createInventoryBagIcon(scene, 0, 0, 28);
    this.title = scene.add.text(0, 0, "Inventory", {
      color: "#f8fafc",
      fontFamily: FONT_FAMILY,
      fontSize: "26px",
      fontStyle: "bold",
    });
    this.subtitle = scene.add.text(0, 0, "", {
      color: "#94a3b8",
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
    });
    this.closeButton = scene.add
      .text(0, 0, "닫기", {
        color: "#f8fafc",
        fontFamily: FONT_FAMILY,
        fontSize: "14px",
        backgroundColor: "#263449",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.closeButton.on(Phaser.Input.Events.POINTER_DOWN, () => this.onClose());
    this.closeButton.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.closeButton.setStyle({ backgroundColor: "#3b4d66" });
    });
    this.closeButton.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.closeButton.setStyle({ backgroundColor: "#263449" });
    });

    this.footer = scene.add.text(0, 0, "휠로 목록 스크롤 · I / Esc 닫기", {
      color: "#94a3b8",
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
    });
    this.scrollTrack = scene.add.rectangle(0, 0, 4, 1, 0x1e293b, 1).setOrigin(0);
    this.scrollThumb = scene.add.rectangle(0, 0, 4, 1, 0x5eead4, 1).setOrigin(0);

    this.container.add([
      this.blocker,
      this.panel,
      this.contentBackdrop,
      this.contentRoot,
      this.scrollTrack,
      this.scrollThumb,
      this.titleIcon,
      this.title,
      this.subtitle,
      this.closeButton,
      this.footer,
    ]);
    this.layout(width, height);
  }

  layout(width: number, height: number): void {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const layout = createInventoryModalLayout(safeWidth, safeHeight);

    this.blocker.setPosition(safeWidth / 2, safeHeight / 2).setSize(safeWidth, safeHeight);
    const blockerHitArea = this.blocker.input?.hitArea;
    if (blockerHitArea instanceof Phaser.Geom.Rectangle) {
      blockerHitArea.setSize(safeWidth, safeHeight);
    }

    this.panel.setPosition(layout.panelX, layout.panelY).setSize(layout.panelWidth, layout.panelHeight);
    this.contentBackdrop
      .setPosition(layout.contentX, layout.contentY)
      .setSize(layout.contentWidth, layout.contentHeight);
    const titleIconSize = layout.compact ? 22 : 28;
    this.titleIcon
      .setPosition(layout.panelX + layout.padding + titleIconSize / 2, layout.panelY + (layout.compact ? 24 : 29))
      .setScale(titleIconSize / 28);
    this.title
      .setPosition(layout.panelX + layout.padding + titleIconSize + 8, layout.panelY + (layout.compact ? 14 : 14))
      .setFontSize(layout.compact ? "20px" : "26px");
    this.subtitle
      .setPosition(layout.panelX + layout.padding + titleIconSize + 8, layout.panelY + (layout.compact ? 38 : 45))
      .setText(`장비 ${this.view.equipment.length}개 · 유물 ${this.view.relics.length}개`);
    this.closeButton
      .setPosition(layout.panelX + layout.panelWidth - layout.padding, layout.panelY + (layout.compact ? 24 : 30))
      .setFontSize(layout.compact ? "12px" : "14px");
    this.footer
      .setPosition(
        layout.panelX + layout.panelWidth / 2,
        layout.panelY + layout.panelHeight - (layout.compact ? 16 : 19),
      )
      .setOrigin(0.5, 0.5)
      .setFontSize(layout.compact ? "9px" : "11px");

    this.contentX = layout.contentX;
    this.contentY = layout.contentY;
    this.contentHeight = layout.contentHeight;
    this.scrollbarX = layout.scrollbarX;
    this.maskShape.clear();
    this.maskShape.fillStyle(0xffffff, 1);
    this.maskShape.fillRect(layout.contentX, layout.contentY, layout.contentWidth, layout.contentHeight);

    this.contentRoot.removeAll(true);
    const loadoutHeight = this.renderCombatLoadoutSection(0, 0, layout.contentWidth, layout.compact);
    const sectionGap = loadoutHeight > 0 ? 18 : 0;
    const equipmentY = loadoutHeight + sectionGap;
    const wide = !layout.compact && layout.contentWidth >= 700;
    const columnGap = 14;
    const equipmentWidth = wide ? Math.floor((layout.contentWidth - columnGap) * 0.58) : layout.contentWidth;
    const relicWidth = wide ? layout.contentWidth - equipmentWidth - columnGap : layout.contentWidth;
    const equipmentHeight = this.renderEquipmentSection(0, equipmentY, equipmentWidth, layout.compact);

    let usedHeight = equipmentY + equipmentHeight;
    if (wide) {
      usedHeight = Math.max(
        usedHeight,
        equipmentY + this.renderRelicSection(equipmentWidth + columnGap, equipmentY, relicWidth, layout.compact),
      );
    } else {
      const relicY = equipmentY + equipmentHeight + 18;
      usedHeight = this.renderRelicSection(0, relicY, relicWidth, layout.compact);
    }

    this.maxScroll = Math.max(0, usedHeight - layout.contentHeight);
    this.scrollOffset = clampInventoryModalScroll(this.scrollOffset, this.maxScroll);
    this.applyScroll();
  }

  private renderCombatLoadoutSection(x: number, y: number, width: number, compact: boolean): number {
    const selection = this.combatLoadout;
    if (selection === undefined || selection.options.length === 0) return 0;

    const height = compact ? 126 : 112;
    const panel = this.scene.add
      .rectangle(x, y, width, height, 0x14263b, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, 0xf6c85f, 0.9);
    this.contentRoot.add(panel);
    this.addText(this.contentRoot, x + 14, y + 10, "전투 장비 선택", {
      color: "#f8fafc",
      fontSize: compact ? "14px" : "16px",
      fontStyle: "bold",
    });
    this.addText(this.contentRoot, x + 14, y + (compact ? 34 : 38), "전투에 가져갈 장비 구성을 선택하세요.", {
      color: "#fcd34d",
      fontSize: compact ? "9px" : "10px",
    });

    const gap = compact ? 8 : 12;
    const buttonY = compact ? 62 : 68;
    const buttonHeight = compact ? 52 : 42;
    const buttonWidth = (width - 28 - gap * (selection.options.length - 1)) / selection.options.length;
    selection.options.forEach((option, index) => {
      const button = this.scene.add
        .rectangle(x + 14 + index * (buttonWidth + gap), y + buttonY, buttonWidth, buttonHeight, 0x263449, 1)
        .setOrigin(0)
        .setStrokeStyle(1, 0x5eead4, 0.9)
        .setInteractive({ useHandCursor: true });
      const weaponName = EQUIPMENT_BY_ID.get(option.weaponId)?.name ?? option.weaponId;
      const subweaponName =
        option.subweaponId === null
          ? "보조무기 없음"
          : (EQUIPMENT_BY_ID.get(option.subweaponId)?.name ?? option.subweaponId);
      const label =
        option.mode === "two-handed"
          ? `양손무기\n${weaponName}`
          : `한손무기 + 보조무기\n${weaponName} · ${subweaponName}`;
      const text = this.scene.add
        .text(button.x + buttonWidth / 2, button.y + buttonHeight / 2, label, {
          color: "#edf5ff",
          fontFamily: FONT_FAMILY,
          fontSize: compact ? "8px" : "10px",
          align: "center",
          wordWrap: { width: Math.max(1, buttonWidth - 12) },
        })
        .setOrigin(0.5);
      button.on(Phaser.Input.Events.POINTER_OVER, () => button.setFillStyle(0x36506c, 1));
      button.on(Phaser.Input.Events.POINTER_OUT, () => button.setFillStyle(0x263449, 1));
      button.on(Phaser.Input.Events.POINTER_DOWN, () => selection.onSelect(option.mode));
      this.contentRoot.add([button, text]);
    });
    return height;
  }

  scroll(deltaY: number): void {
    if (!Number.isFinite(deltaY) || this.maxScroll <= 0) return;
    this.scrollOffset = clampInventoryModalScroll(this.scrollOffset - deltaY * 0.75, this.maxScroll);
    this.applyScroll();
  }

  destroy(): void {
    this.contentRoot.clearMask(true);
    this.maskShape.destroy();
    this.container.destroy(true);
  }

  private applyScroll(): void {
    this.contentRoot.setPosition(this.contentX, this.contentY + this.scrollOffset);

    const hasOverflow = this.maxScroll > 0;
    this.scrollTrack.setPosition(this.scrollbarX, this.contentY).setSize(4, this.contentHeight).setVisible(hasOverflow);

    if (!hasOverflow) {
      this.scrollThumb.setVisible(false);
      return;
    }

    const thumbHeight = Math.max(28, this.contentHeight * (this.contentHeight / (this.contentHeight + this.maxScroll)));
    const scrollRatio = this.maxScroll === 0 ? 0 : -this.scrollOffset / this.maxScroll;
    this.scrollThumb
      .setPosition(this.scrollbarX, this.contentY + (this.contentHeight - thumbHeight) * scrollRatio)
      .setSize(4, thumbHeight)
      .setVisible(true);
  }

  private renderEquipmentSection(x: number, y: number, width: number, compact: boolean): number {
    const title = this.addText(this.contentRoot, x, y, "보유 장비", {
      color: "#f8fafc",
      fontSize: compact ? "15px" : "17px",
      fontStyle: "bold",
    });
    const count = this.addText(this.contentRoot, x + width, y + 3, `${this.view.equipment.length}개`, {
      color: "#fcd34d",
      fontSize: compact ? "10px" : "11px",
    });
    count.setOrigin(1, 0);

    let cursorY = y + Math.max(34, title.height + 17);
    if (this.view.equipment.length === 0) {
      this.addText(this.contentRoot, x, cursorY, "보유한 장비가 없습니다.", {
        color: "#64748b",
        fontSize: compact ? "11px" : "12px",
      });
      return cursorY + 42;
    }

    for (const equipment of this.view.equipment) {
      cursorY += this.renderEquipmentCard(x, cursorY, width, equipment, compact) + 10;
    }
    return cursorY - 10;
  }

  private renderEquipmentCard(
    x: number,
    y: number,
    width: number,
    equipment: InventoryEquipmentView,
    compact: boolean,
  ): number {
    const card = this.scene.add.container(x, y);
    const padding = compact ? 9 : 12;
    const iconSize = compact ? 48 : 64;
    const iconTextureKey = this.getEquipmentIconTextureKey(equipment);
    const textX = padding + (iconTextureKey === undefined ? 0 : iconSize + 12);
    const textWidth = Math.max(1, width - textX - padding);
    if (iconTextureKey !== undefined) {
      this.addEquipmentIcon(card, padding, padding, iconSize, equipment, iconTextureKey);
    }
    const name = this.addText(
      card,
      textX,
      padding - 1,
      equipment.name,
      {
        color: "#f8fafc",
        fontSize: compact ? "12px" : "15px",
        fontStyle: "bold",
      },
      textWidth,
    );
    const meta = this.addText(
      card,
      textX,
      name.y + name.height + 4,
      `${equipment.isEquipped ? "장착 중 · " : "보유 중 · "}${SLOT_LABELS[equipment.slot]} · ${RARITY_LABELS[equipment.rarity]}`,
      {
        color: this.toColor(RARITY_COLORS[equipment.rarity]),
        fontSize: compact ? "8px" : "10px",
      },
    );

    let cursorY = meta.y + meta.height + (compact ? 7 : 9);
    for (const skill of equipment.skills) {
      const skillName = this.addText(
        card,
        textX,
        cursorY,
        `${skill.name}  /${skill.command}`,
        {
          color: "#5eead4",
          fontSize: compact ? "9px" : "11px",
          fontStyle: "bold",
        },
        textWidth,
      );
      const effect = this.addText(
        card,
        textX + 8,
        skillName.y + skillName.height + 2,
        skill.effect,
        {
          color: "#cbd5e1",
          fontSize: compact ? "9px" : "11px",
          lineSpacing: compact ? 2 : 3,
        },
        Math.max(1, textWidth - 8),
      );
      cursorY = effect.y + effect.height + (compact ? 6 : 8);
    }

    const cardHeight = Math.max(
      compact ? 76 : 100,
      iconTextureKey === undefined ? 0 : iconSize + padding * 2,
      cursorY + padding / 2,
    );
    const background = this.scene.add
      .rectangle(0, 0, width, cardHeight, equipment.isEquipped ? 0x173448 : 0x111c2c, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, RARITY_COLORS[equipment.rarity], equipment.isEquipped ? 1 : 0.72);
    const accent = this.scene.add.rectangle(0, 0, 4, cardHeight, RARITY_COLORS[equipment.rarity], 0.92).setOrigin(0);
    card.addAt(background, 0);
    card.addAt(accent, 1);
    this.contentRoot.add(card);
    return cardHeight;
  }

  private renderRelicSection(x: number, y: number, width: number, compact: boolean): number {
    const title = this.addText(this.contentRoot, x, y, "보유 유물", {
      color: "#f8fafc",
      fontSize: compact ? "15px" : "17px",
      fontStyle: "bold",
    });
    const count = this.addText(this.contentRoot, x + width, y + 3, `${this.view.relics.length}개`, {
      color: "#fcd34d",
      fontSize: compact ? "10px" : "11px",
    });
    count.setOrigin(1, 0);

    let cursorY = y + Math.max(34, title.height + 17);
    if (this.view.relics.length === 0) {
      this.addText(this.contentRoot, x, cursorY, "보유한 유물이 없습니다.", {
        color: "#64748b",
        fontSize: compact ? "11px" : "12px",
      });
      return cursorY + 42;
    }

    for (const relic of this.view.relics) {
      cursorY += this.renderRelicCard(x, cursorY, width, relic, compact) + 10;
    }
    return cursorY - 10;
  }

  private renderRelicCard(x: number, y: number, width: number, relic: InventoryRelicView, compact: boolean): number {
    const card = this.scene.add.container(x, y);
    const padding = compact ? 9 : 12;
    const iconSize = compact ? 48 : 64;
    const iconTextureKey = this.getRelicIconTextureKey(relic);
    const textX = padding + (iconTextureKey === undefined ? 0 : iconSize + 12);
    const textWidth = Math.max(1, width - textX - padding);
    if (iconTextureKey !== undefined) {
      this.addRelicIcon(card, padding, padding, iconSize, relic, iconTextureKey);
    }
    const name = this.addText(
      card,
      textX,
      padding - 1,
      relic.name,
      {
        color: "#f8fafc",
        fontSize: compact ? "12px" : "15px",
        fontStyle: "bold",
      },
      textWidth,
    );
    const meta = this.addText(
      card,
      textX,
      name.y + name.height + 4,
      `${relic.isActive ? "적용 중" : "보유 중"} · ${RARITY_LABELS[relic.rarity]}`,
      {
        color: this.toColor(RARITY_COLORS[relic.rarity]),
        fontSize: compact ? "8px" : "10px",
      },
    );
    const description = this.addText(
      card,
      textX,
      meta.y + meta.height + (compact ? 7 : 9),
      relic.description,
      {
        color: "#cbd5e1",
        fontSize: compact ? "9px" : "11px",
        lineSpacing: compact ? 2 : 3,
      },
      textWidth,
    );
    const cardHeight = Math.max(
      compact ? 62 : 78,
      iconTextureKey === undefined ? 0 : iconSize + padding * 2,
      description.y + description.height + padding / 2,
    );
    const background = this.scene.add
      .rectangle(0, 0, width, cardHeight, relic.isActive ? 0x29243a : 0x111c2c, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, RARITY_COLORS[relic.rarity], relic.isActive ? 1 : 0.72);
    const accent = this.scene.add.rectangle(0, 0, 4, cardHeight, RARITY_COLORS[relic.rarity], 0.92).setOrigin(0);
    card.addAt(background, 0);
    card.addAt(accent, 1);
    this.contentRoot.add(card);
    return cardHeight;
  }

  private addEquipmentIcon(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    size: number,
    equipment: InventoryEquipmentView,
    textureKey: string,
  ): void {
    const color = RARITY_COLORS[equipment.rarity];
    const frame = this.scene.add
      .rectangle(x, y, size, size, 0x0b1220, 0.95)
      .setOrigin(0)
      .setStrokeStyle(2, color, equipment.isEquipped ? 1 : 0.85);
    parent.add(frame);

    parent.add(this.scene.add.image(x + size / 2, y + size / 2, textureKey).setDisplaySize(size - 8, size - 8));
  }

  private addRelicIcon(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    size: number,
    relic: InventoryRelicView,
    textureKey: string,
  ): void {
    const color = RARITY_COLORS[relic.rarity];
    const frame = this.scene.add
      .rectangle(x, y, size, size, 0x0b1220, 0.95)
      .setOrigin(0)
      .setStrokeStyle(2, color, relic.isActive ? 1 : 0.85);
    parent.add(frame);

    parent.add(this.scene.add.image(x + size / 2, y + size / 2, textureKey).setDisplaySize(size - 8, size - 8));
  }

  private getEquipmentIconTextureKey(equipment: InventoryEquipmentView): string | undefined {
    const textureKey = resolveEquipmentIconTextureKey(equipment.id);
    if (textureKey !== undefined && this.scene.textures.exists(textureKey)) {
      return textureKey;
    }
    const ringTextureKey = resolveRingIconTextureKey(equipment.id);
    return ringTextureKey !== undefined && this.scene.textures.exists(ringTextureKey) ? ringTextureKey : undefined;
  }

  private getRelicIconTextureKey(relic: InventoryRelicView): string | undefined {
    const textureKey = getRelicIconTextureKey(relic.id);
    return this.scene.textures.exists(textureKey) ? textureKey : undefined;
  }

  private addText(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    wordWrapWidth?: number,
  ): Phaser.GameObjects.Text {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: FONT_FAMILY,
      ...style,
    });
    if (wordWrapWidth !== undefined) {
      label.setWordWrapWidth(Math.max(1, wordWrapWidth));
    }
    parent.add(label);
    return label;
  }

  private toColor(color: number): string {
    return Phaser.Display.Color.IntegerToColor(color).rgba;
  }
}
