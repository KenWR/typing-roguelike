import type { GeneratedMapNode, RunState } from "@typing-roguelike/shared";
import { createMapHudView } from "../run/map-hud-view";
import { routeMapNodeSelection } from "../run/map-node-routing";
import { runRemotePersistence } from "../run/run-remote-persistence";
import { RUN_RESUME_CHECKPOINT_VERSION } from "../run/run-resume-checkpoint";
import { runSession } from "../run/run-session";
import { MapScene } from "./CoreFlowScenes";
import { SCENE_KEYS } from "./scene-contract";

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

    const { width } = this.scale.gameSize;
    const nodeXs = [width / 2 - 240, width / 2, width / 2 + 240];
    const view = createMapHudView(activeRun);

    view.nodes.forEach((node, index) => {
      if (node.status !== "available") return;

      const x = nodeXs[index] ?? width / 2;
      const hitArea = this.add
        .rectangle(x, 500, 190, 116, 0xffffff, 0.001)
        .setOrigin(0.5)
        .setDepth(50)
        .setInteractive({ useHandCursor: true });

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
            nextNodeIds:
              (route.payload.nextNodeIds as readonly string[] | undefined) ?? [],
          });
        }

        void runRemotePersistence.checkpoint(route.runState);
        const scenePayload = route.sceneKey === SCENE_KEYS.reward
          ? { ...route.payload, suppressPointerUntilRelease: true }
          : route.payload;
        this.scene.start(route.sceneKey, scenePayload);
      });
    });
  }
}
