import Phaser from "phaser";
import type { GeneratedMapNode, RunState, ShopOffer } from "@typing-roguelike/shared";
import { RUN_RESUME_CHECKPOINT_VERSION } from "../run/run-resume-checkpoint";
import { runSession } from "../run/run-session";
import { formatShopOfferLabel } from "../shop/shop-offer-label";
import {
  completeShopNode,
  createShopNodeFlow,
  purchaseShopOffer,
  type ShopNodeFlowState,
} from "../shop/shop-node-flow";

export type ShopNodeSceneData = Readonly<{
  runState: RunState;
  nodeId: string;
  node?: GeneratedMapNode;
  nextNodeIds: readonly string[];
  offers?: readonly ShopOffer[];
  purchasedOfferIds?: readonly string[];
}>;

export class ShopNodeScene extends Phaser.Scene {
  private flow!: ShopNodeFlowState;
  private node?: GeneratedMapNode;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super("ShopScene");
  }

  init(data: ShopNodeSceneData): void {
    this.node = data.node;
    this.flow = createShopNodeFlow(
      data.runState,
      data.nodeId,
      data.nextNodeIds,
      data.offers,
      data.purchasedOfferIds,
    );
    this.syncCheckpoint();
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#111827");
    this.add.text(36, 32, "상점", { fontFamily: "Galmuri9, monospace", fontSize: "30px", color: "#f9fafb" });
    this.statusText = this.add.text(36, 76, `보유 재화: ${this.flow.runState.runCurrency}`, { fontFamily: "Galmuri9, monospace", fontSize: "18px", color: "#f5cf72" });

    this.flow.offers.forEach((offer, index) => {
      const button = this.add.text(36, 126 + index * 52, formatShopOfferLabel(offer), {
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        color: "#f9fafb",
        backgroundColor: "#243247",
        padding: { x: 12, y: 8 },
      }).setInteractive({ useHandCursor: true });

      button.on("pointerdown", () => {
        this.flow = purchaseShopOffer(this.flow, offer.id);
        this.syncSession();
        this.syncCheckpoint();
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
      runSession.clearCheckpoint();
      this.scene.start("MapScene", { runState: this.flow.runState });
    });
  }

  private syncSession(): void {
    const active = runSession.get();
    if (active?.status === "active") {
      runSession.update(() => this.flow.runState);
    }
  }

  private syncCheckpoint(): void {
    const node = this.node ?? runSession.getCheckpoint()?.node;
    if (node === undefined) return;
    runSession.setCheckpoint({
      version: RUN_RESUME_CHECKPOINT_VERSION,
      sceneKey: "ShopScene",
      node,
      nextNodeIds: this.flow.nextNodeIds,
      shopOffers: this.flow.offers,
      purchasedOfferIds: [...this.flow.purchasedOfferIds],
    });
  }
}
