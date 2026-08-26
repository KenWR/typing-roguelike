import Phaser from "phaser";
import {
  EQUIPMENT_RARITY_COLORS,
  EQUIPMENT_RARITY_LABELS,
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SLOTS,
  type EquipmentAdapter,
  type EquipmentDefinition,
  type EquipmentRarity,
  type EquipmentSkill,
  createEquipmentAdapter,
} from "../equipment/equipment-adapter";
import {
  createEquipmentViewState,
  equipSelectedEquipment,
  getSkillComparison,
  selectEquipment,
  selectSlot,
  type EquipmentViewState,
} from "../equipment/equipment-view-state";

export type EquipmentSceneData = Readonly<{
  adapter?: EquipmentAdapter;
}>;

type Box = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type EquipmentSceneLayout = Readonly<{
  compact: boolean;
  slots: Box;
  inventory: Box;
  skills: Box;
}>;

const COLORS = {
  background: 0x09111e,
  backgroundGlow: 0x12233a,
  panel: 0x101b2b,
  panelRaised: 0x16253a,
  panelMuted: 0x0d1726,
  border: 0x34445b,
  text: "#edf5ff",
  textMuted: "#93a4ba",
  textSubtle: "#64748b",
  teal: 0x4fd1c5,
  tealText: "#5eead4",
  gold: 0xf6c85f,
  goldText: "#fcd34d",
  red: 0xfb7185,
  redText: "#fda4af",
  green: 0x86efac,
  greenText: "#bbf7d0",
} as const;

const FONT_FAMILY = "Galmuri9, 'Apple SD Gothic Neo', monospace";
const WIDE_BREAKPOINT = 900;

export class EquipmentScene extends Phaser.Scene {
  private adapter: EquipmentAdapter = createEquipmentAdapter();
  private state!: EquipmentViewState;
  private uiLayer!: Phaser.GameObjects.Container;
  private statusMessage = "장비를 선택하면 교체 전후 스킬을 비교합니다.";

  constructor() {
    super("EquipmentScene");
  }

  init(data?: EquipmentSceneData): void {
    this.adapter = data?.adapter ?? createEquipmentAdapter();
  }

  preload(): void {
    const snapshot = this.adapter.getSnapshot();
    const loadedPaths = new Set<string>();

    for (const equipment of snapshot.ownedEquipment) {
      const key = this.getTextureKey(equipment.id);
      if (this.textures.exists(key) || loadedPaths.has(equipment.iconPath)) {
        continue;
      }

      loadedPaths.add(equipment.iconPath);
      this.load.image(key, equipment.iconPath);
    }
  }

  create(): void {
    this.state = createEquipmentViewState(this.adapter.getSnapshot());
    this.uiLayer = this.add.container(0, 0);

    for (const equipment of this.state.snapshot.ownedEquipment) {
      this.createMissingIconTextureIfNeeded(equipment);
    }

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseResizeListener, this);
    this.render();
  }

  private handleResize(): void {
    if (this.state) {
      this.render();
    }
  }

  private render(): void {
    const width = Math.max(320, this.scale.gameSize.width || this.scale.width);
    const height = Math.max(480, this.scale.gameSize.height || this.scale.height);
    const layout = this.createLayout(width, height);

    this.cameras.main.setViewport(0, 0, width, height);
    this.uiLayer.removeAll(true);
    this.renderBackground(width, height);
    this.renderHeader(width, layout.compact);
    this.renderSlots(layout.slots, layout.compact);
    this.renderInventory(layout.inventory, layout.compact);
    this.renderSkills(layout.skills, layout.compact);
  }

  private renderBackground(width: number, height: number): void {
    this.uiLayer.add(
      this.add.rectangle(0, 0, width, height, COLORS.background).setOrigin(0),
    );
    this.uiLayer.add(
      this.add
        .rectangle(width * 0.78, height * 0.25, width * 0.55, height * 0.8, COLORS.backgroundGlow, 0.18)
        .setAngle(-18),
    );

    for (let x = -height; x < width + height; x += 96) {
      this.uiLayer.add(
        this.add
          .rectangle(x, 0, 1, height * 1.8, 0x27415d, 0.13)
          .setOrigin(0, 0)
          .setAngle(28),
      );
    }

    this.uiLayer.add(
      this.add
        .rectangle(0, 0, width, 3, COLORS.teal, 0.8)
        .setOrigin(0),
    );
  }

  private renderHeader(width: number, compact: boolean): void {
    const inset = compact ? 16 : 32;
    const titleY = compact ? 18 : 22;
    const titleSize = compact ? "22px" : "28px";

    this.addText(this.uiLayer, inset, titleY, "장비 장착", {
      color: COLORS.text,
      fontSize: titleSize,
      fontStyle: "bold",
    });
    this.addText(this.uiLayer, inset, titleY + (compact ? 28 : 36), "LOADOUT // FE-06", {
      color: COLORS.tealText,
      fontSize: compact ? "10px" : "12px",
    });

    const rightLabel = compact ? "4 SLOTS" : "4 SLOTS  ·  ARSENAL ONLINE";
    const right = this.addText(this.uiLayer, width - inset, titleY + 8, rightLabel, {
      color: COLORS.textMuted,
      fontSize: compact ? "10px" : "12px",
    });
    right.setOrigin(1, 0);
  }

  private renderSlots(box: Box, compact: boolean): void {
    const panel = this.createPanel(this.uiLayer, box, COLORS.teal, 0.9);
    this.addText(panel, 16, 14, "장착 슬롯", {
      color: COLORS.text,
      fontSize: compact ? "15px" : "17px",
      fontStyle: "bold",
    });
    this.addText(panel, 16, compact ? 36 : 39, "슬롯을 선택하세요", {
      color: COLORS.textMuted,
      fontSize: compact ? "10px" : "11px",
    });

    const gap = compact ? 8 : 10;
    const contentTop = compact ? 58 : 64;
    const columns = compact ? 2 : 1;
    const rows = Math.ceil(EQUIPMENT_SLOTS.length / columns);
    const cardWidth = (box.width - 24 - gap * (columns - 1)) / columns;
    const cardHeight = (box.height - contentTop - 12 - gap * (rows - 1)) / rows;

    EQUIPMENT_SLOTS.forEach((slot, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = 12 + column * (cardWidth + gap);
      const y = contentTop + row * (cardHeight + gap);
      const current = this.getEquipment(this.state.snapshot.equippedBySlot[slot]);
      const active = this.state.activeSlot === slot;
      const card = this.createInteractiveContainer(cardWidth, cardHeight, () => {
        this.state = selectSlot(this.state, slot);
        this.statusMessage = `${EQUIPMENT_SLOT_LABELS[slot]} 슬롯의 장비를 선택하세요.`;
        this.render();
      });
      card.setPosition(box.x + x, box.y + y);

      const cardBackground = this.add
        .rectangle(0, 0, cardWidth, cardHeight, active ? 0x173448 : COLORS.panelMuted, 0.98)
        .setOrigin(0)
        .setStrokeStyle(2, active ? COLORS.teal : COLORS.border, active ? 1 : 0.8);
      card.add(cardBackground);

      const iconSize = compact ? Math.min(36, cardHeight - 20) : Math.min(58, cardHeight - 28);
      this.addEquipmentIcon(card, current, compact ? 22 : 34, cardHeight / 2, iconSize);
      this.addText(card, compact ? 46 : 70, compact ? 10 : 15, EQUIPMENT_SLOT_LABELS[slot], {
        color: active ? COLORS.tealText : COLORS.textMuted,
        fontSize: compact ? "9px" : "11px",
      });
      const name = this.addText(card, compact ? 46 : 70, compact ? 25 : 34, current.name, {
        color: COLORS.text,
        fontSize: compact ? "10px" : "15px",
        fontStyle: "bold",
      });
      name.setWordWrapWidth(Math.max(84, cardWidth - (compact ? 56 : 84)));
      this.addText(card, compact ? 46 : 70, compact ? cardHeight - 17 : cardHeight - 25, EQUIPMENT_RARITY_LABELS[current.rarity], {
        color: this.getRarityTextColor(current.rarity),
        fontSize: compact ? "8px" : "10px",
      });

      this.addHoverFeedback(card, cardBackground, active ? 0x1d4b55 : COLORS.panelRaised, active ? COLORS.teal : COLORS.border);
      this.uiLayer.add(card);
    });
  }

  private renderInventory(box: Box, compact: boolean): void {
    const panel = this.createPanel(this.uiLayer, box, COLORS.gold, 0.75);
    this.addText(panel, 16, 14, "보유 장비", {
      color: COLORS.text,
      fontSize: compact ? "15px" : "17px",
      fontStyle: "bold",
    });
    const count = this.state.snapshot.ownedEquipment.length;
    const countText = this.addText(panel, box.width - 16, 16, `${count} ITEMS`, {
      color: COLORS.goldText,
      fontSize: compact ? "9px" : "10px",
    });
    countText.setOrigin(1, 0);

    const gap = compact ? 6 : 8;
    const contentTop = compact ? 48 : 54;
    const columns = 2;
    const rows = Math.ceil(count / columns);
    const cardWidth = (box.width - 24 - gap) / columns;
    const cardHeight = Math.max(34, (box.height - contentTop - 10 - gap * (rows - 1)) / rows);

    this.state.snapshot.ownedEquipment.forEach((equipment, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const card = this.createInteractiveContainer(cardWidth, cardHeight, () => {
        this.state = selectSlot(this.state, equipment.slot);
        this.state = selectEquipment(this.state, equipment.id);
        this.statusMessage = `${equipment.name}의 스킬 변화를 확인 중입니다.`;
        this.render();
      });
      card.setPosition(
        box.x + 12 + column * (cardWidth + gap),
        box.y + contentTop + row * (cardHeight + gap),
      );

      const equipped = this.state.snapshot.equippedBySlot[equipment.slot] === equipment.id;
      const selected = this.state.selectedEquipmentId === equipment.id;
      const cardBackground = this.add
        .rectangle(0, 0, cardWidth, cardHeight, selected ? 0x3a2f1d : COLORS.panelMuted, 0.98)
        .setOrigin(0)
        .setStrokeStyle(2, selected ? COLORS.gold : equipped ? EQUIPMENT_RARITY_COLORS[equipment.rarity] : COLORS.border, selected || equipped ? 1 : 0.65);
      card.add(cardBackground);

      const iconSize = Math.min(compact ? 26 : 44, cardHeight - 10);
      this.addEquipmentIcon(card, equipment, compact ? 18 : 28, cardHeight / 2, iconSize);
      const textX = compact ? 37 : 56;
      const name = this.addText(card, textX, compact ? 6 : 10, equipment.name, {
        color: COLORS.text,
        fontSize: compact ? "9px" : "12px",
        fontStyle: "bold",
      });
      name.setWordWrapWidth(Math.max(72, cardWidth - textX - 8));
      this.addText(card, textX, compact ? cardHeight - 14 : cardHeight - 21, `${EQUIPMENT_SLOT_LABELS[equipment.slot]} · ${EQUIPMENT_RARITY_LABELS[equipment.rarity]}`, {
        color: this.getRarityTextColor(equipment.rarity),
        fontSize: compact ? "7px" : "9px",
      });

      if (equipped) {
        const badge = this.addText(card, cardWidth - 8, compact ? 5 : 8, "EQUIPPED", {
          color: COLORS.greenText,
          fontSize: compact ? "7px" : "8px",
        });
        badge.setOrigin(1, 0);
      } else if (selected) {
        const badge = this.addText(card, cardWidth - 8, compact ? 5 : 8, "PREVIEW", {
          color: COLORS.goldText,
          fontSize: compact ? "7px" : "8px",
        });
        badge.setOrigin(1, 0);
      }

      this.addHoverFeedback(card, cardBackground, selected ? 0x4a3a20 : COLORS.panelRaised, selected ? COLORS.gold : COLORS.border);
      this.uiLayer.add(card);
    });
  }

  private renderSkills(box: Box, compact: boolean): void {
    const panel = this.createPanel(this.uiLayer, box, COLORS.teal, 0.75);
    const comparison = getSkillComparison(this.state);
    const currentId = this.state.snapshot.equippedBySlot[this.state.activeSlot];
    const hasChange = currentId !== this.state.selectedEquipmentId;

    this.addText(panel, 16, 14, "스킬 비교", {
      color: COLORS.text,
      fontSize: compact ? "15px" : "17px",
      fontStyle: "bold",
    });
    this.addText(panel, 16, compact ? 36 : 39, hasChange ? "교체 전후 구성" : "현재 장비 구성", {
      color: hasChange ? COLORS.goldText : COLORS.textMuted,
      fontSize: compact ? "10px" : "11px",
    });
    const status = this.addText(panel, box.width - 16, 16, hasChange ? "PREVIEW" : "EQUIPPED", {
      color: hasChange ? COLORS.goldText : COLORS.greenText,
      fontSize: compact ? "9px" : "10px",
    });
    status.setOrigin(1, 0);

    const actionHeight = compact ? 38 : 42;
    const actionY = box.height - actionHeight - 12;
    const comparisonTop = compact ? 59 : 65;
    const comparisonHeight = actionY - comparisonTop - 10;
    const gap = compact ? 7 : 10;

    if (compact) {
      const groupHeight = (comparisonHeight - gap) / 2;
      this.renderSkillGroup(panel, 12, comparisonTop, box.width - 24, groupHeight, "교체 전", comparison.before, false, true);
      this.renderSkillGroup(panel, 12, comparisonTop + groupHeight + gap, box.width - 24, groupHeight, "교체 후", comparison.after, true, true);
    } else {
      const groupWidth = (box.width - 24 - gap) / 2;
      const groupHeight = comparisonHeight;
      this.renderSkillGroup(panel, 12, comparisonTop, groupWidth, groupHeight, "교체 전", comparison.before, false, false);
      this.renderSkillGroup(panel, 12 + groupWidth + gap, comparisonTop, groupWidth, groupHeight, "교체 후", comparison.after, true, false);
    }

    this.renderSkillDelta(panel, box, comparison, compact, actionY);

    const button = this.createInteractiveContainer(box.width - 24, actionHeight, () => {
      if (!hasChange) {
        return;
      }

      this.state = equipSelectedEquipment(this.state, this.adapter);
      this.statusMessage = `${comparison.after.name} 장착 완료 · 스킬 구성이 적용되었습니다.`;
      this.render();
    });
    button.setPosition(box.x + 12, box.y + actionY);
    const buttonBackground = this.add
      .rectangle(0, 0, box.width - 24, actionHeight, hasChange ? COLORS.teal : COLORS.panelRaised, 1)
      .setOrigin(0)
      .setStrokeStyle(2, hasChange ? COLORS.teal : COLORS.border, 1);
    button.add(buttonBackground);
    const buttonLabel = this.addText(button, (box.width - 24) / 2, actionHeight / 2, hasChange ? "장착하기" : "현재 장착 중", {
      color: hasChange ? "#07151d" : COLORS.textMuted,
      fontSize: compact ? "12px" : "14px",
      fontStyle: "bold",
    });
    buttonLabel.setOrigin(0.5);
    this.addHoverFeedback(button, buttonBackground, hasChange ? 0x73e4d8 : COLORS.panelRaised, hasChange ? COLORS.gold : COLORS.border);
    this.uiLayer.add(button);

    if (!compact) {
      const message = this.addText(this.uiLayer, box.x, box.y + box.height + 6, this.statusMessage, {
        color: hasChange ? COLORS.goldText : COLORS.textMuted,
        fontSize: "10px",
      });
      message.setWordWrapWidth(box.width);
    }
  }

  private renderSkillGroup(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    equipment: EquipmentDefinition,
    emphasized: boolean,
    compact: boolean,
  ): void {
    const group = this.add.container(x, y);
    const background = this.add
      .rectangle(0, 0, width, height, emphasized ? 0x1d2935 : COLORS.panelMuted, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, emphasized ? COLORS.gold : COLORS.border, 0.9);
    group.add(background);
    this.addText(group, 10, 8, label, {
      color: emphasized ? COLORS.goldText : COLORS.textMuted,
      fontSize: compact ? "8px" : "9px",
    });
    const name = this.addText(group, 10, compact ? 21 : 24, equipment.name, {
      color: COLORS.text,
      fontSize: compact ? "10px" : "12px",
      fontStyle: "bold",
    });
    name.setWordWrapWidth(width - 20);

    const skillTop = compact ? 43 : 50;
    const skillGap = compact ? 3 : 6;
    const availableHeight = Math.max(30, height - skillTop - 8);
    const skillHeight = compact
      ? Math.max(
          18,
          (availableHeight - skillGap * (equipment.skills.length - 1)) /
            equipment.skills.length,
        )
      : Math.max(
          24,
          (availableHeight - skillGap * (equipment.skills.length - 1)) /
            equipment.skills.length,
        );
    equipment.skills.forEach((skill, index) => {
      this.renderSkillRow(group, 8, skillTop + index * (skillHeight + skillGap), width - 16, skillHeight, skill, compact);
    });
    parent.add(group);
  }

  private renderSkillRow(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    skill: EquipmentSkill,
    compact: boolean,
  ): void {
    const row = this.add
      .rectangle(x, y, width, height, COLORS.panelRaised, 0.72)
      .setOrigin(0)
      .setStrokeStyle(1, 0x40526b, 0.75);
    parent.add(row);
    const skillName = this.addText(parent, x + 7, y + 4, skill.name, {
      color: COLORS.text,
      fontSize: compact ? "8px" : "10px",
      fontStyle: "bold",
    });
    skillName.setWordWrapWidth(Math.max(80, width - 74));
    const command = this.addText(parent, x + width - 7, y + 5, `/${skill.command}`, {
      color: COLORS.tealText,
      fontSize: compact ? "6px" : "8px",
    });
    command.setOrigin(1, 0);
    const summary = this.addText(parent, x + 7, y + height - (compact ? 8 : 15), skill.summary, {
      color: COLORS.textMuted,
      fontSize: compact ? "6px" : "8px",
    });
    summary.setWordWrapWidth(Math.max(80, width - 14));
  }

  private renderSkillDelta(
    parent: Phaser.GameObjects.Container,
    box: Box,
    comparison: ReturnType<typeof getSkillComparison>,
    compact: boolean,
    actionY: number,
  ): void {
    const addedLabel = `+${comparison.added.length} NEW`;
    const removedLabel = `-${comparison.removed.length} REMOVED`;
    this.addText(parent, 14, actionY - (compact ? 19 : 21), addedLabel, {
      color: comparison.added.length > 0 ? COLORS.greenText : COLORS.textSubtle,
      fontSize: compact ? "8px" : "9px",
    });
    const removed = this.addText(parent, box.width - 14, actionY - (compact ? 19 : 21), removedLabel, {
      color: comparison.removed.length > 0 ? COLORS.redText : COLORS.textSubtle,
      fontSize: compact ? "8px" : "9px",
    });
    removed.setOrigin(1, 0);
  }

  private createLayout(width: number, height: number): EquipmentSceneLayout {
    const compact = width < WIDE_BREAKPOINT;

    if (compact) {
      const inset = 14;
      const top = 76;
      const gap = 12;
      const available = Math.max(450, height - top - inset - gap * 2);
      const slotsHeight = Math.min(190, Math.max(156, available * 0.25));
      const inventoryHeight = Math.min(270, Math.max(220, available * 0.33));
      const skillsHeight = Math.max(220, available - slotsHeight - inventoryHeight);

      return {
        compact,
        slots: { x: inset, y: top, width: width - inset * 2, height: slotsHeight },
        inventory: { x: inset, y: top + slotsHeight + gap, width: width - inset * 2, height: inventoryHeight },
        skills: { x: inset, y: top + slotsHeight + inventoryHeight + gap * 2, width: width - inset * 2, height: skillsHeight },
      };
    }

    const inset = Math.min(32, Math.max(24, Math.min(width, height) * 0.035));
    const top = 88;
    const gap = 14;
    const contentHeight = Math.max(420, height - top - inset);
    const slotsWidth = Math.min(360, Math.max(300, width * 0.29));
    const inventoryWidth = Math.min(390, Math.max(330, width * 0.31));
    const skillsWidth = Math.max(300, width - inset * 2 - gap * 2 - slotsWidth - inventoryWidth);

    return {
      compact,
      slots: { x: inset, y: top, width: slotsWidth, height: contentHeight },
      inventory: { x: inset + slotsWidth + gap, y: top, width: inventoryWidth, height: contentHeight },
      skills: { x: inset + slotsWidth + inventoryWidth + gap * 2, y: top, width: skillsWidth, height: contentHeight },
    };
  }

  private createPanel(
    parent: Phaser.GameObjects.Container,
    box: Box,
    accent: number,
    accentAlpha: number,
  ): Phaser.GameObjects.Container {
    const panel = this.add.container(box.x, box.y);
    panel.add(
      this.add
        .rectangle(0, 0, box.width, box.height, COLORS.panel, 0.97)
        .setOrigin(0)
        .setStrokeStyle(2, COLORS.border, 0.95),
    );
    panel.add(
      this.add
        .rectangle(0, 0, 4, box.height, accent, accentAlpha)
        .setOrigin(0),
    );
    parent.add(panel);
    return panel;
  }

  private createInteractiveContainer(
    width: number,
    height: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setSize(width, height);
    const interactionTarget = this.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains,
      );
    interactionTarget.on(Phaser.Input.Events.POINTER_DOWN, onClick);
    container.setData("interactionTarget", interactionTarget);
    container.add(interactionTarget);
    return container;
  }

  private addHoverFeedback(
    container: Phaser.GameObjects.Container,
    background: Phaser.GameObjects.Rectangle,
    hoverColor: number,
    hoverBorder: number,
  ): void {
    const baseColor = background.fillColor;
    const baseAlpha = background.fillAlpha;
    const baseBorder = background.strokeColor;
    const baseBorderAlpha = background.strokeAlpha;
    const interactionTarget = container.getData(
      "interactionTarget",
    ) as Phaser.GameObjects.Rectangle | undefined;
    const eventTarget = interactionTarget ?? container;
    eventTarget.on(Phaser.Input.Events.POINTER_OVER, () => {
      background.setFillStyle(hoverColor, 1).setStrokeStyle(2, hoverBorder, 1);
    });
    eventTarget.on(Phaser.Input.Events.POINTER_OUT, () => {
      background
        .setFillStyle(baseColor, baseAlpha)
        .setStrokeStyle(2, baseBorder, baseBorderAlpha);
    });
  }

  private addEquipmentIcon(
    parent: Phaser.GameObjects.Container,
    equipment: EquipmentDefinition,
    x: number,
    y: number,
    size: number,
  ): void {
    const key = this.getTextureKey(equipment.id);
    if (this.textures.exists(key)) {
      parent.add(this.add.image(x, y, key).setDisplaySize(size, size));
      return;
    }

    parent.add(
      this.add
        .rectangle(x, y, size, size, 0x17263a, 1)
        .setStrokeStyle(2, EQUIPMENT_RARITY_COLORS[equipment.rarity], 1),
    );
    const marker = this.addText(parent, x, y, "◆", {
      color: this.getRarityTextColor(equipment.rarity),
      fontSize: `${Math.max(10, Math.round(size * 0.36))}px`,
    });
    marker.setOrigin(0.5);
  }

  private createMissingIconTextureIfNeeded(equipment: EquipmentDefinition): void {
    const key = this.getTextureKey(equipment.id);
    if (this.textures.exists(key)) {
      return;
    }

    const icon = this.make.graphics({ x: 0, y: 0 }, false);
    icon.fillStyle(0x15263a, 1);
    icon.fillRect(0, 0, 64, 64);
    icon.lineStyle(3, EQUIPMENT_RARITY_COLORS[equipment.rarity], 1);
    icon.strokeRect(5, 5, 54, 54);
    icon.lineBetween(16, 48, 32, 16);
    icon.lineBetween(32, 16, 48, 48);
    icon.generateTexture(key, 64, 64);
    icon.destroy();
  }

  private getEquipment(equipmentId: string): EquipmentDefinition {
    const equipment = this.state.snapshot.ownedEquipment.find(
      (candidate) => candidate.id === equipmentId,
    );

    if (!equipment) {
      throw new Error(`Equipment snapshot is missing ${equipmentId}.`);
    }

    return equipment;
  }

  private getTextureKey(equipmentId: string): string {
    return `equipment-icon-${equipmentId}`;
  }

  private getRarityTextColor(rarity: EquipmentRarity): string {
    return Phaser.Display.Color.IntegerToColor(EQUIPMENT_RARITY_COLORS[rarity]).rgba;
  }

  private addText(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, {
      fontFamily: FONT_FAMILY,
      ...style,
    });
    parent.add(label);
    return label;
  }

  private releaseResizeListener(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }
}
