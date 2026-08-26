import Phaser from "phaser";
import {
  getCombatLoadoutOptions,
  type CombatLoadoutMode,
  type CombatLoadoutOption,
  type GeneratedMapNode,
  type MapNodeStatus,
  type RunState,
} from "@typing-roguelike/shared";
import { playWalkSound } from "../audio/runtime-audio";
import { InventoryModal } from "../inventory/inventory-modal";
import { createInventoryBagIcon } from "../inventory/inventory-icons";
import { resolveInventoryModalKey } from "../inventory/inventory-modal-state";
import {
  getMapNodeIconTextureFrame,
  type RenderableMapNodeIconType,
} from "../assets/map-node-assets";
import { createMapHudView } from "../run/map-hud-view";
import { routeMapNodeSelection } from "../run/map-node-routing";
import { runRemotePersistence } from "../run/run-remote-persistence";
import { RUN_RESUME_CHECKPOINT_VERSION } from "../run/run-resume-checkpoint";
import { runSession } from "../run/run-session";
import { MapScene } from "./CoreFlowScenes";
import { SCENE_KEYS } from "./scene-contract";

const MAP_VIEW_TOP = 292;
const MAP_VIEW_BOTTOM_MARGIN = 30;
const MAP_ROW_GAP = 150;
const MAP_BOSS_Y = 70;
const MAP_NODE_WIDTH = 130;
const MAP_NODE_HEIGHT = 86;
const MAP_VIEW_SIDE_PADDING = 16;
const MAP_LANE_SIDE_PADDING = 24;
const MAP_MIN_LANE_GAP = 40;
const MAP_MAX_LANE_GAP = 220;
const MAP_CURRENT_NODE_BOTTOM_GAP = 14;
const INVENTORY_BUTTON_ICON_BASE_SIZE = 22;

type InventoryButtonMetrics = Readonly<{
  width: number;
  height: number;
  centerY: number;
  sideMargin: number;
  iconX: number;
  iconSize: number;
  labelX: number;
  fontSize: string;
}>;

const getInventoryButtonMetrics = (width: number): InventoryButtonMetrics => {
  const compact = width < 640;
  return {
    width: compact ? 160 : 184,
    height: compact ? 36 : 42,
    centerY: compact ? 242 : 42,
    sideMargin: width < 960 ? 16 : 28,
    iconX: compact ? 20 : 23,
    iconSize: compact ? 18 : INVENTORY_BUTTON_ICON_BASE_SIZE,
    labelX: compact ? 42 : 48,
    fontSize: compact ? "14px" : "16px",
  };
};
const MAP_NODE_ICON_Y_OFFSET = -22;
const MAP_NODE_TYPE_Y_OFFSET = 20;
const MAP_NODE_STATUS_Y_OFFSET = 38;
const MAP_LEGEND_WIDTH = 180;
const MAP_LEGEND_HEIGHT = 230;
const MAP_LEGEND_SIDE_BREAKPOINT = 1120;
const MAP_LEGEND_GAP = 24;
const MAP_LEGEND_SIDE_MARGIN = 16;
const MAP_DOTTED_LINE_GAP = 13;
const MAP_DOTTED_LINE_RADIUS = 2.3;

const MAP_NODE_ICON_SIZE = 58;

type MapLayout = Readonly<{
  width: number;
  height: number;
  centerX: number;
  mapLeft: number;
  mapRight: number;
  mapWidth: number;
  mapViewportHeight: number;
  laneXs: readonly number[];
  currentNodeViewportY: number;
  minY: number;
  maxY: number;
  useSideLegend: boolean;
}>;

const MAP_NODE_TYPES: readonly RenderableMapNodeIconType[] = [
  "rest",
  "combat",
  "elite",
  "shop",
  "boss",
];

const NODE_TYPE_LABEL: Record<RenderableMapNodeIconType, string> = {
  rest: "휴식",
  combat: "전투",
  elite: "엘리트",
  shop: "상점",
  boss: "보스전",
};

const NODE_LABEL: Record<string, string> = {
  locked: "LOCKED",
  available: "AVAILABLE",
  in_progress: "IN PROGRESS",
  cleared: "CLEARED",
};

const NODE_STATUS_COLOR: Record<MapNodeStatus, string> = {
  locked: "#9ca3af",
  available: "#93c5fd",
  in_progress: "#fbbf24",
  cleared: "#86efac",
};

const NODE_STATUS_FILL: Record<MapNodeStatus, number> = {
  locked: 0x9ca3af,
  available: 0x60a5fa,
  in_progress: 0xf59e0b,
  cleared: 0x4ade80,
};

const NODE_ICON_ALPHA: Record<MapNodeStatus, number> = {
  locked: 0.38,
  available: 1,
  in_progress: 1,
  cleared: 0.65,
};

const drawDottedLine = (
  graphics: Phaser.GameObjects.Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void => {
  const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
  const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);

  graphics.fillStyle(0x4b5563, 0.72);
  for (let offset = 0; offset <= distance; offset += MAP_DOTTED_LINE_GAP) {
    graphics.fillCircle(
      startX + Math.cos(angle) * offset,
      startY + Math.sin(angle) * offset,
      MAP_DOTTED_LINE_RADIUS,
    );
  }
};

export class InteractiveMapScene extends MapScene {
  protected override readonly renderLegacyMapChoices = false;
  private routeRunState?: Readonly<RunState>;
  private selectionLocked = false;
  private inventoryModal?: InventoryModal;
  private inventoryButton?: Phaser.GameObjects.Container;
  private inventoryButtonBackground?: Phaser.GameObjects.Rectangle;
  private inventoryButtonIcon?: Phaser.GameObjects.Graphics;
  private inventoryButtonLabel?: Phaser.GameObjects.Text;

  init(data: { runState?: Readonly<RunState> }): void {
    this.routeRunState = data.runState;
    this.selectionLocked = false;
    super.init(data);
  }

  create(): void {
    super.create();

    const activeRun = this.routeRunState ?? runSession.get();
    if (activeRun === null || activeRun === undefined) return;

    const view = createMapHudView(activeRun);
    const { width: initialWidth } = this.scale.gameSize;
    this.inventoryButton = this.createInventoryButton(initialWidth);
    this.input.keyboard?.on("keydown", this.handleInventoryKeyDown, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleInventoryResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseInventoryInput, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseInventoryInput, this);
    const floorY = (round: number): number => MAP_BOSS_Y + (10 - round) * MAP_ROW_GAP;

    const calculateLayout = (): MapLayout => {
      const { width, height } = this.scale.gameSize;
      const useSideLegend = width >= MAP_LEGEND_SIDE_BREAKPOINT;
      const centerX = useSideLegend
        ? (MAP_VIEW_SIDE_PADDING + width - MAP_LEGEND_WIDTH - MAP_LEGEND_GAP) / 2
        : width / 2;
      const mapLeft = MAP_VIEW_SIDE_PADDING;
      const mapRight = useSideLegend
        ? width - MAP_LEGEND_WIDTH - MAP_LEGEND_GAP
        : width - MAP_VIEW_SIDE_PADDING;
      const mapWidth = Math.max(1, mapRight - mapLeft);
      const laneAreaWidth = Math.max(0, mapWidth - MAP_LANE_SIDE_PADDING * 2);
      const desiredLaneGap = (laneAreaWidth - MAP_NODE_WIDTH * 3) / 2;
      const laneGap = Phaser.Math.Clamp(desiredLaneGap, MAP_MIN_LANE_GAP, MAP_MAX_LANE_GAP);
      const laneContentWidth = MAP_NODE_WIDTH * 3 + laneGap * 2;
      const laneContentLeft = centerX - laneContentWidth / 2;
      const laneXs = [
        laneContentLeft + MAP_NODE_WIDTH / 2,
        centerX,
        laneContentLeft + laneContentWidth - MAP_NODE_WIDTH / 2,
      ];
      const mapBottom = Math.max(MAP_VIEW_TOP + MAP_NODE_HEIGHT, height - MAP_VIEW_BOTTOM_MARGIN);
      const mapViewportHeight = Math.max(MAP_NODE_HEIGHT, mapBottom - MAP_VIEW_TOP);
      const currentNodeViewportY = mapBottom - MAP_NODE_HEIGHT / 2 - MAP_CURRENT_NODE_BOTTOM_GAP;
      const bossY = floorY(10);
      const floorOneY = floorY(1);

      return {
        width,
        height,
        centerX,
        mapLeft,
        mapRight,
        mapWidth,
        mapViewportHeight,
        laneXs,
        currentNodeViewportY,
        minY: currentNodeViewportY - floorOneY,
        maxY: MAP_VIEW_TOP + MAP_NODE_HEIGHT / 2 + MAP_CURRENT_NODE_BOTTOM_GAP - bossY,
        useSideLegend,
      };
    };

    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    const mapMask = maskShape.createGeometryMask();

    const mapContainer = this.add.container(0, 0).setDepth(90).setMask(mapMask);
    const nodeById = new Map(view.nodes.map((node) => [node.id, node] as const));
    const connections: Array<{
      from: (typeof view.nodes)[number];
      to: (typeof view.nodes)[number];
      line: Phaser.GameObjects.Graphics;
    }> = [];
    const nodeVisuals: Array<{
      node: (typeof view.nodes)[number];
      icon?: Phaser.GameObjects.Image;
      marker?: Phaser.GameObjects.Arc;
      typeText: Phaser.GameObjects.Text;
      statusText: Phaser.GameObjects.Text;
      hitArea?: Phaser.GameObjects.Rectangle;
    }> = [];

    for (const node of view.nodes) {
      for (const nextId of node.nextNodeIds) {
        const next = nodeById.get(nextId);
        if (next === undefined || next.round <= node.round) continue;
        const line = this.add.graphics();
        mapContainer.add(line);
        connections.push({ from: node, to: next, line });
      }
    }

    let layout = calculateLayout();

    for (const node of view.nodes) {
      const label = NODE_LABEL[node.status] ?? "LOCKED";
      const iconFrame = getMapNodeIconTextureFrame(node.iconType);
      const statusColor = NODE_STATUS_COLOR[node.status];
      const marker =
        node.status === "locked"
          ? undefined
          : this.add
              .circle(0, 0, MAP_NODE_ICON_SIZE / 2 + 6, NODE_STATUS_FILL[node.status], 0.08)
              .setStrokeStyle(2, NODE_STATUS_FILL[node.status], 0.82);
      const nodeIcon =
        iconFrame === undefined
          ? undefined
          : this.add
              .image(0, 0, iconFrame.key, iconFrame.frame)
              .setDisplaySize(MAP_NODE_ICON_SIZE, MAP_NODE_ICON_SIZE)
              .setAlpha(NODE_ICON_ALPHA[node.status]);
      const typeText = this.add
        .text(0, 0, `${node.round}F · ${node.type.toUpperCase()}`, {
          fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
          fontSize: node.type === "boss" ? "18px" : "15px",
          color: "#ffffff",
          align: "center",
          stroke: "#101827",
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      const statusText = this.add
        .text(0, 0, label, {
          fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
          fontSize: "12px",
          color: statusColor,
          stroke: "#101827",
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      mapContainer.add([
        ...(marker === undefined ? [] : [marker]),
        ...(nodeIcon === undefined ? [] : [nodeIcon]),
        typeText,
        statusText,
      ]);

      const nodeVisual: (typeof nodeVisuals)[number] = {
        node,
        icon: nodeIcon,
        marker,
        typeText,
        statusText,
      };
      nodeVisuals.push(nodeVisual);

      if (node.status !== "available") continue;

      const hitArea = this.add
        .rectangle(0, 0, MAP_NODE_WIDTH, MAP_NODE_HEIGHT, 0xffffff, 0.001)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      mapContainer.add(hitArea);
      nodeVisual.hitArea = hitArea;

      hitArea.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (marker !== undefined && this.isMapViewportPointer(pointer, layout)) {
          marker.setStrokeStyle(3, NODE_STATUS_FILL[node.status], 1);
        }
      });
      hitArea.on("pointerout", () => {
        marker?.setStrokeStyle(2, NODE_STATUS_FILL[node.status], 0.82);
      });
      hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (!this.isMapViewportPointer(pointer, layout)) return;
        if (this.selectionLocked || this.inventoryModal !== undefined) return;
        const currentRun = runSession.get() ?? activeRun;
        if (
          node.type === "combat" ||
          node.type === "elite" ||
          node.type === "boss"
        ) {
          const loadoutOptions = getCombatLoadoutOptions(currentRun);
          if (loadoutOptions.length > 1) {
            this.openCombatLoadoutModal(node.id, currentRun, loadoutOptions);
            return;
          }
          this.routeSelectedNode(
            node.id,
            currentRun,
            loadoutOptions[0]?.mode,
          );
          return;
        }

        this.routeSelectedNode(node.id, currentRun);
      });

    }

    const legendContainer = this.add.container(0, 0).setDepth(101);
    const legendPanel = this.add
      .rectangle(0, 0, 1, 1, 0x111827, 0.78)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0xc4a05a, 0.72);
    const legendTitle = this.add
      .text(0, 0, "범례", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "19px",
        fontStyle: "bold",
        color: "#f6d68c",
        stroke: "#111827",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const legendEntries = MAP_NODE_TYPES.map((type) => {
      const iconFrame = getMapNodeIconTextureFrame(type);
      const icon =
        iconFrame === undefined
          ? undefined
          : this.add.image(0, 0, iconFrame.key, iconFrame.frame).setAlpha(1);
      const label = this.add.text(0, 0, NODE_TYPE_LABEL[type], {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "14px",
        color: "#f3f4f6",
        stroke: "#111827",
        strokeThickness: 3,
      });
      return { icon, label };
    });
    legendContainer.add([
      legendPanel,
      legendTitle,
      ...legendEntries.flatMap(({ icon, label }) => (icon === undefined ? [label] : [icon, label])),
    ]);

    const scrollHint = this.add
      .text(0, 0, "마우스 휠로 전체 경로 스크롤", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "13px",
        color: "#9ca3af",
        stroke: "#101827",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(100);

    const layoutLegend = (): void => {
      const { width, centerX, useSideLegend } = layout;
      if (useSideLegend) {
        const legendX = width - MAP_LEGEND_SIDE_MARGIN - MAP_LEGEND_WIDTH / 2;
        const legendY = MAP_VIEW_TOP + MAP_LEGEND_HEIGHT / 2 + 6;
        legendPanel.setPosition(legendX, legendY).setSize(MAP_LEGEND_WIDTH, MAP_LEGEND_HEIGHT);
        legendTitle.setPosition(legendX, legendY - MAP_LEGEND_HEIGHT / 2 + 25);
        legendEntries.forEach(({ icon, label }, index) => {
          const rowY = legendY - MAP_LEGEND_HEIGHT / 2 + 61 + index * 34;
          icon?.setPosition(legendX - 57, rowY).setDisplaySize(30, 30);
          label.setPosition(legendX - 31, rowY).setOrigin(0, 0.5);
        });
        return;
      }

      const panelWidth = Math.max(1, width - MAP_VIEW_SIDE_PADDING * 2);
      const legendX = centerX;
      const legendY = MAP_VIEW_TOP - 40;
      const itemWidth = Math.max(62, Math.min(92, (panelWidth - 24) / MAP_NODE_TYPES.length));
      const rowStartX = legendX - (itemWidth * MAP_NODE_TYPES.length) / 2 + itemWidth / 2;
      legendPanel.setPosition(legendX, legendY).setSize(panelWidth, 74);
      legendTitle.setPosition(legendX, legendY - 24);
      legendEntries.forEach(({ icon, label }, index) => {
        const itemX = rowStartX + itemWidth * index;
        icon?.setPosition(itemX - 17, legendY + 11).setDisplaySize(23, 23);
        label.setPosition(itemX + 1, legendY + 11).setOrigin(0, 0.5).setFontSize(width < 600 ? "11px" : "12px");
      });
    };

    const layoutMap = (): void => {
      layout = calculateLayout();
      maskShape.clear();
      maskShape.fillStyle(0xffffff);
      maskShape.fillRect(MAP_VIEW_SIDE_PADDING, MAP_VIEW_TOP, layout.mapWidth, layout.mapViewportHeight);

      for (const visual of nodeVisuals) {
        const x = layout.laneXs[visual.node.choice - 1] ?? layout.centerX;
        const y = floorY(visual.node.round);
        const iconY = y + MAP_NODE_ICON_Y_OFFSET;
        visual.marker?.setPosition(x, iconY);
        visual.icon?.setPosition(x, iconY);
        visual.typeText.setPosition(x, y + MAP_NODE_TYPE_Y_OFFSET);
        visual.statusText.setPosition(x, y + MAP_NODE_STATUS_Y_OFFSET);
        visual.hitArea?.setPosition(x, y);
      }

      for (const connection of connections) {
        const fromX = layout.laneXs[connection.from.choice - 1] ?? layout.centerX;
        const toX = layout.laneXs[connection.to.choice - 1] ?? layout.centerX;
        const fromIconY = floorY(connection.from.round) + MAP_NODE_ICON_Y_OFFSET;
        const toIconY = floorY(connection.to.round) + MAP_NODE_ICON_Y_OFFSET;
        connection.line.clear();
        drawDottedLine(
          connection.line,
          fromX,
          fromIconY - MAP_NODE_ICON_SIZE / 2 - 7,
          toX,
          toIconY + MAP_NODE_ICON_SIZE / 2 + 7,
        );
      }

      const currentY = floorY(Math.min(10, Math.max(1, activeRun.map.currentRound)));
      mapContainer.y = Phaser.Math.Clamp(
        layout.currentNodeViewportY - currentY,
        layout.minY,
        layout.maxY,
      );
      scrollHint.setPosition(layout.centerX, layout.height - 8);
      layoutLegend();
    };

    layoutMap();

    const handleMapWheel = (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ): void => {
      if (this.inventoryModal !== undefined) {
        this.inventoryModal.scroll(deltaY);
        return;
      }

      mapContainer.y = Phaser.Math.Clamp(
        mapContainer.y - deltaY * 0.65,
        layout.minY,
        layout.maxY,
      );
    };
    this.input.on(
      "wheel",
      handleMapWheel,
      this,
    );
    const releaseMapWheel = (): void => {
      this.input.off("wheel", handleMapWheel, this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, releaseMapWheel);
    this.events.once(Phaser.Scenes.Events.DESTROY, releaseMapWheel);

    const handleResize = (): void => {
      const runState = runSession.get() ?? activeRun;
      this.scene.restart({ runState });
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, handleResize);
    });
  }

  private isMapViewportPointer(
    pointer: Phaser.Input.Pointer,
    layout: MapLayout,
  ): boolean {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return (
      point.x >= layout.mapLeft &&
      point.x <= layout.mapRight &&
      point.y >= MAP_VIEW_TOP &&
      point.y <= MAP_VIEW_TOP + layout.mapViewportHeight
    );
  }

  private openCombatLoadoutModal(
    nodeId: string,
    runState: Readonly<RunState>,
    options: readonly CombatLoadoutOption[],
  ): void {
    this.inventoryModal = new InventoryModal(
      this,
      runState,
      () => this.closeInventoryModal(),
      {
        combatLoadout: {
          options,
          onSelect: (mode) => {
            this.closeInventoryModal();
            this.routeSelectedNode(nodeId, runState, mode);
          },
        },
      },
    );
  }

  private routeSelectedNode(
    nodeId: string,
    fallbackRunState: Readonly<RunState>,
    combatLoadout?: CombatLoadoutMode,
  ): void {
    const runState = runSession.get() ?? fallbackRunState;
    const route = routeMapNodeSelection(
      runState,
      nodeId,
      combatLoadout === undefined ? {} : { combatLoadout },
    );
    if (!route.applied) return;

    this.selectionLocked = true;
    this.input.enabled = false;
    playWalkSound();
    if (runSession.get()?.status === "active") {
      runSession.update(() => route.runState);
    }

    const selectedNode = route.payload.node as GeneratedMapNode | undefined;
    if (selectedNode !== undefined && route.sceneKey !== SCENE_KEYS.map) {
      runSession.setCheckpoint({
        version: RUN_RESUME_CHECKPOINT_VERSION,
        sceneKey: route.sceneKey,
        node: selectedNode,
        nextNodeIds: (route.payload.nextNodeIds as readonly string[] | undefined) ?? [],
      });
    }

    void runRemotePersistence.checkpoint(route.runState);
    this.scene.start(route.sceneKey, route.payload);
  }

  private createInventoryButton(width: number): Phaser.GameObjects.Container {
    const metrics = getInventoryButtonMetrics(width);
    const button = this.add
      .container(
        width - metrics.sideMargin - metrics.width,
        metrics.centerY - metrics.height / 2,
      )
      .setDepth(120);
    const background = this.add
      .rectangle(0, 0, metrics.width, metrics.height, 0x263449, 1)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    const icon = createInventoryBagIcon(
      this,
      metrics.iconX,
      metrics.height / 2,
      INVENTORY_BUTTON_ICON_BASE_SIZE,
    ).setScale(metrics.iconSize / INVENTORY_BUTTON_ICON_BASE_SIZE);
    const label = this.add
      .text(metrics.labelX, metrics.height / 2, "Inventory [I]", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: metrics.fontSize,
        color: "#f8fafc",
      })
      .setOrigin(0, 0.5);

    button.add([background, icon, label]);
    background.on(Phaser.Input.Events.POINTER_DOWN, () => this.toggleInventoryModal());
    background.on(Phaser.Input.Events.POINTER_OVER, () => {
      background.setFillStyle(0x3b4d66, 1);
    });
    background.on(Phaser.Input.Events.POINTER_OUT, () => {
      background.setFillStyle(0x263449, 1);
    });
    this.inventoryButtonBackground = background;
    this.inventoryButtonIcon = icon;
    this.inventoryButtonLabel = label;
    return button;
  }

  private handleInventoryKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;

    const action = resolveInventoryModalKey(
      event.key,
      this.inventoryModal !== undefined,
    );
    if (action === "ignore") return;

    event.preventDefault();
    if (action === "toggle") {
      this.toggleInventoryModal();
      return;
    }

    this.closeInventoryModal();
  }

  private toggleInventoryModal(): void {
    if (this.inventoryModal !== undefined) {
      this.closeInventoryModal();
      return;
    }

    const activeRun = this.routeRunState ?? runSession.get();
    if (activeRun === null || activeRun === undefined) return;

    this.inventoryModal = new InventoryModal(
      this,
      activeRun,
      () => this.closeInventoryModal(),
    );
  }

  private closeInventoryModal(): void {
    const modal = this.inventoryModal;
    if (modal === undefined) return;

    this.inventoryModal = undefined;
    modal.destroy();
  }

  private handleInventoryResize(gameSize: Phaser.Structs.Size): void {
    const button = this.inventoryButton;
    if (button !== undefined) {
      const metrics = getInventoryButtonMetrics(gameSize.width);
      button
        .setPosition(
          gameSize.width - metrics.sideMargin - metrics.width,
          metrics.centerY - metrics.height / 2,
        );
      this.inventoryButtonBackground
        ?.setSize(metrics.width, metrics.height)
        .setPosition(0, 0);
      this.inventoryButtonIcon
        ?.setPosition(metrics.iconX, metrics.height / 2)
        .setScale(metrics.iconSize / INVENTORY_BUTTON_ICON_BASE_SIZE);
      this.inventoryButtonLabel
        ?.setPosition(metrics.labelX, metrics.height / 2)
        .setFontSize(metrics.fontSize);
    }
    this.inventoryModal?.layout(gameSize.width, gameSize.height);
  }

  private releaseInventoryInput(): void {
    this.input.keyboard?.off("keydown", this.handleInventoryKeyDown, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleInventoryResize, this);
    this.closeInventoryModal();
    this.inventoryButton?.destroy();
    this.inventoryButton = undefined;
    this.inventoryButtonBackground = undefined;
    this.inventoryButtonIcon = undefined;
    this.inventoryButtonLabel = undefined;
  }
}
