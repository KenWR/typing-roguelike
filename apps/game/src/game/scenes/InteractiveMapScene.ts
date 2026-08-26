import Phaser from "phaser";
import type { GeneratedMapNode, RunState } from "@typing-roguelike/shared";
import { createMapHudView } from "../run/map-hud-view";
import { routeMapNodeSelection } from "../run/map-node-routing";
import { runRemotePersistence } from "../run/run-remote-persistence";
import { RUN_RESUME_CHECKPOINT_VERSION } from "../run/run-resume-checkpoint";
import { runSession } from "../run/run-session";
import { MapScene } from "./CoreFlowScenes";
import { SCENE_KEYS } from "./scene-contract";

const MAP_VIEW_TOP = 292;
const MAP_VIEW_BOTTOM_MARGIN = 24;
const MAP_ROW_GAP = 150;
const MAP_BOSS_Y = 70;
const MAP_NODE_WIDTH = 130;
const MAP_NODE_HEIGHT = 86;
const MAP_SIDE_GUTTER = 340;
const MAP_LANE_PADDING = 16;

const NODE_FILL: Record<string, number> = {
  locked: 0x374151,
  available: 0x2563eb,
  in_progress: 0xd97706,
  cleared: 0x15803d,
};

const NODE_LABEL: Record<string, string> = {
  locked: "LOCKED",
  available: "AVAILABLE",
  in_progress: "IN PROGRESS",
  cleared: "CLEARED",
};

export class InteractiveMapScene extends MapScene {
  private routeRunState?: Readonly<RunState>;
  private selectionLocked = false;

  init(data: { runState?: Readonly<RunState> }): void {
    this.routeRunState = data.runState;
    this.selectionLocked = false;
    super.init(data);
  }

  create(): void {
    super.create();

    const activeRun = this.routeRunState ?? runSession.get();
    if (activeRun === null || activeRun === undefined) return;

    const { width, height } = this.scale.gameSize;
    const view = createMapHudView(activeRun);
    const centerX = width / 2;
    const mapLeft = Math.max(MAP_SIDE_GUTTER, centerX - 310);
    const mapRight = Math.min(width - MAP_SIDE_GUTTER, centerX + 310);
    const mapWidth = Math.max(360, mapRight - mapLeft);
    const laneLeft = mapLeft + MAP_NODE_WIDTH / 2 + MAP_LANE_PADDING;
    const laneRight = mapRight - MAP_NODE_WIDTH / 2 - MAP_LANE_PADDING;
    const laneXs = [laneLeft, (laneLeft + laneRight) / 2, laneRight];
    const mapBottom = height - MAP_VIEW_BOTTOM_MARGIN;
    const floorY = (round: number): number => MAP_BOSS_Y + (10 - round) * MAP_ROW_GAP;

    this.add
      .rectangle(centerX, (MAP_VIEW_TOP + height) / 2, mapWidth, height - MAP_VIEW_TOP, 0x111827, 1)
      .setOrigin(0.5)
      .setDepth(80);

    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(mapLeft, MAP_VIEW_TOP, mapWidth, mapBottom - MAP_VIEW_TOP);
    const mapMask = maskShape.createGeometryMask();

    const mapContainer = this.add.container(0, 0).setDepth(90).setMask(mapMask);
    const nodeById = new Map(view.nodes.map((node) => [node.id, node] as const));

    for (const node of view.nodes) {
      const x = laneXs[node.choice - 1] ?? centerX;
      const y = floorY(node.round);
      for (const nextId of node.nextNodeIds) {
        const next = nodeById.get(nextId);
        if (next === undefined || next.round <= node.round) continue;
        const nextX = laneXs[next.choice - 1] ?? centerX;
        const nextY = floorY(next.round);
        const line = this.add.line(0, 0, x, y - MAP_NODE_HEIGHT / 2, nextX, nextY + MAP_NODE_HEIGHT / 2, 0x4b5563)
          .setOrigin(0)
          .setLineWidth(3);
        mapContainer.add(line);
      }
    }

    for (const node of view.nodes) {
      const x = laneXs[node.choice - 1] ?? centerX;
      const y = floorY(node.round);
      const fill = NODE_FILL[node.status] ?? NODE_FILL.locked;
      const label = NODE_LABEL[node.status] ?? "LOCKED";

      const card = this.add.rectangle(x, y, MAP_NODE_WIDTH, MAP_NODE_HEIGHT, fill).setOrigin(0.5);
      const typeText = this.add
        .text(x, y - 17, `${node.round}F · ${node.type.toUpperCase()}`, {
          fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
          fontSize: node.type === "boss" ? "18px" : "15px",
          color: "#ffffff",
          align: "center",
        })
        .setOrigin(0.5);
      const statusText = this.add
        .text(x, y + 16, label, {
          fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
          fontSize: "12px",
          color: "#e5e7eb",
        })
        .setOrigin(0.5);
      mapContainer.add([card, typeText, statusText]);

      if (node.status !== "available") continue;

      const hitArea = this.add
        .rectangle(x, y, MAP_NODE_WIDTH, MAP_NODE_HEIGHT, 0xffffff, 0.001)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      mapContainer.add(hitArea);

      hitArea.on("pointerover", () => hitArea.setFillStyle(0xffffff, 0.08));
      hitArea.on("pointerout", () => hitArea.setFillStyle(0xffffff, 0.001));
      hitArea.once("pointerdown", () => {
        if (this.selectionLocked) return;

        const route = routeMapNodeSelection(activeRun, node.id);
        if (!route.applied) return;

        this.selectionLocked = true;
        this.input.enabled = false;
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
      });
    }

    const floorOneY = floorY(1);
    const bossY = floorY(10);
    const minY = mapBottom - floorOneY;
    const maxY = MAP_VIEW_TOP + 52 - bossY;
    const currentY = floorY(Math.min(10, Math.max(1, activeRun.map.currentRound)));
    mapContainer.y = Phaser.Math.Clamp(mapBottom - currentY, minY, maxY);

    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        mapContainer.y = Phaser.Math.Clamp(mapContainer.y - deltaY * 0.65, minY, maxY);
      },
    );

    this.add
      .text(centerX, height - 16, "마우스 휠로 전체 경로 스크롤", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "13px",
        color: "#9ca3af",
      })
      .setOrigin(0.5, 1)
      .setDepth(100);
  }
}
