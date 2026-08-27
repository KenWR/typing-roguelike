import Phaser from "phaser";
import type { RunState } from "@typing-roguelike/shared";
import { TEXTURE_KEYS } from "../assets/asset-catalog";
import { runSession } from "../run/run-session";
import {
  applyRestNodeRecovery,
  completeRestNode,
  createRestNodeFlow,
  type RestNodeFlowState,
} from "../rest/rest-node-flow";

export type RestNodeSceneData = Readonly<{
  runState: RunState;
  nodeId: string;
  nextNodeIds: readonly string[];
  healAmount?: number;
}>;

export class RestNodeScene extends Phaser.Scene {
  private flow!: RestNodeFlowState;
  private healAmount = 25;

  constructor() {
    super("RestScene");
  }

  init(data: RestNodeSceneData): void {
    this.flow = createRestNodeFlow(
      data.runState,
      data.nodeId,
      data.nextNodeIds,
    );
    this.healAmount = data.healAmount ?? 25;
  }

  create(): void {
    const { width, height } = this.scale.gameSize;

    const background = this.add.image(
      width / 2,
      height / 2,
      TEXTURE_KEYS.restBackground,
    );

    background.setScale(
      Math.max(width / background.width, height / background.height),
    );

    this.add.text(36, 34, "휴식", {
      fontFamily: "Galmuri9, monospace",
      fontSize: "30px",
      color: "#f9fafb",
    });

    this.add.text(
      36,
      82,
      `HP ${this.flow.runState.character.currentHp} / ${this.flow.runState.character.maxHp}`,
      {
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        color: "#d1fae5",
      },
    );

    this.createAction(36, 136, `회복 +${this.healAmount}`, () => {
      this.flow = applyRestNodeRecovery(this.flow, this.healAmount);
      this.finish();
    });
  }

  private createAction(
    x: number,
    y: number,
    label: string,
    action: () => void,
  ): void {
    this.add
      .text(x, y, label, {
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        color: "#f9fafb",
        backgroundColor: "#2f4858",
        padding: { x: 14, y: 9 },
      })
      .setInteractive({ useHandCursor: true })
      .once("pointerdown", action);
  }

  private finish(): void {
    this.flow = completeRestNode(this.flow);

    const active = runSession.get();
    if (active?.status === "active") {
      runSession.update(() => this.flow.runState);
    }

    runSession.clearCheckpoint();
    this.scene.start("MapScene", {
      runState: this.flow.runState,
    });
  }
}