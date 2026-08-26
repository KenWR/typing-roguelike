import Phaser from "phaser";
import type { RunState, ShopOffer } from "@typing-roguelike/shared";
import { runSession } from "../run/run-session";
import {
  completeShopNode,
  createShopNodeFlow,
  purchaseShopOffer,
  type ShopNodeFlowState,
} from "../shop/shop-node-flow";

export type ShopNodeSceneData = Readonly<{
  runState: RunState;
  nodeId: string;
  nextNodeIds: readonly string[];
  offers?: readonly ShopOffer[];
}>;

export class ShopNodeScene extends Phaser.Scene {
  private flow!: ShopNodeFlowState;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super("ShopScene");
  }

  init(data: ShopNodeSceneData): void {
    this.flow = createShopNodeFlow(data.runState, data.nodeId, data.nextNodeIds, data.offers);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#111827");
    this.add.text(36, 32, "상점", { fontFamily: "Galmuri9, monospace", fontSize: "30px", color: "#f9fafb" });
    this.statusText = this.add.text(36, 76, `보유 재화: ${this.flow.runState.runCurrency}`, { fontFamily: "Galmuri9, monospace", fontSize: "18px", color: "#f5cf72" });

    this.flow.offers.forEach((offer, index) => {
      const button = this.add.text(36, 126 + index * 52, `${offer.equipmentId} · ${offer.price}`, {
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        color: "#f9fafb",
        backgroundColor: "#243247",
        padding: { x: 12, y: 8 },
      }).setInteractive({ useHandCursor: true });

      button.on("pointerdown", () => {
        this.flow = purchaseShopOffer(this.flow, offer.id);
        this.syncSession();
        this.statusText?.setText(`보유 재화: ${this.flow.runState.runCurrency}`);
      });
    });

    this.add.text(36, 310, "상점 나가기", {
      fontFamily: "Galmuri9, monospace",
      fontSize: "18px",
      color: "#f9fafb",
      backgroundColor: "#1f6f68",
      padding: { x: 14, y: 9 },
    }).setInteractive({ useHandCursor: true }).once("pointerdown", () => {
      this.flow = completeShopNode(this.flow);
      this.syncSession();
      this.scene.start("MapScene", { runState: this.flow.runState });
    });
  }

  private syncSession(): void {
    const active = runSession.get();
    if (active?.status === "active") {
      runSession.update(() => this.flow.runState);
    }
  }
}
