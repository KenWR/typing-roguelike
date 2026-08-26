import Phaser from "phaser";
import type { GeneratedMapNode, RunState, ShopOffer } from "@typing-roguelike/shared";
import { playCoinSound, playRuntimeBgm } from "../audio/runtime-audio";
import { RUN_RESUME_CHECKPOINT_VERSION } from "../run/run-resume-checkpoint";
import { runSession } from "../run/run-session";
import { formatShopOfferLabel } from "../shop/shop-offer-label";
import {
  completeShopNode,
  createShopNodeFlow,
  getShopRerollCost,
  purchaseShopOffer,
  rerollShopOffers,
  type ShopNodeFlowState,
} from "../shop/shop-node-flow";

export type ShopNodeSceneData = Readonly<{
  runState: RunState;
  nodeId: string;
  node?: GeneratedMapNode;
  nextNodeIds: readonly string[];
  offers?: readonly ShopOffer[];
  purchasedOfferIds?: readonly string[];
  rerollCount?: number;
}>;

export class ShopNodeScene extends Phaser.Scene {
  private flow!: ShopNodeFlowState;
  private node?: GeneratedMapNode;
  private statusText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private rerollButton?: Phaser.GameObjects.Text;
  private offerButtons: Phaser.GameObjects.Text[] = [];

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
      data.rerollCount ?? 0,
    );
    this.syncCheckpoint();
  }

  create(): void {
    playRuntimeBgm("tower");
    this.cameras.main.setBackgroundColor("#111827");
    this.add.text(36, 32, "상점", {
      fontFamily: "Galmuri9, monospace",
      fontSize: "30px",
      color: "#f9fafb",
    });
    this.statusText = this.add.text(36, 76, "", {
      fontFamily: "Galmuri9, monospace",
      fontSize: "18px",
      color: "#f5cf72",
    });
    this.feedbackText = this.add.text(36, 108, "", {
      fontFamily: "Galmuri9, monospace",
      fontSize: "15px",
      color: "#9ca3af",
    });

    this.rerollButton = this.add.text(36, 310, "", {
      fontFamily: "Galmuri9, monospace",
      fontSize: "18px",
      color: "#f9fafb",
      backgroundColor: "#374151",
      padding: { x: 14, y: 9 },
    }).setInteractive({ useHandCursor: true });
    this.rerollButton.on("pointerdown", () => this.handleReroll());

    this.add.text(220, 310, "상점 나가기", {
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

    this.refresh();
  }

  private handlePurchase(offer: ShopOffer): void {
    const beforeCurrency = this.flow.runState.runCurrency;
    const beforeOwned = this.flow.runState.inventory.itemInstances.length;
    this.flow = purchaseShopOffer(this.flow, offer.id);
    const purchased =
      this.flow.runState.runCurrency < beforeCurrency &&
      this.flow.runState.inventory.itemInstances.length > beforeOwned;

    if (purchased) {
      playCoinSound();
      this.feedbackText?.setText("구매 완료").setColor("#86efac");
      this.syncSession();
      this.syncCheckpoint();
    } else if (this.flow.purchasedOfferIds.has(offer.id)) {
      this.feedbackText?.setText("이미 구매한 상품입니다.").setColor("#fbbf24");
    } else if (this.flow.runState.inventory.itemInstances.includes(offer.equipmentId)) {
      this.feedbackText?.setText("이미 보유한 장비입니다.").setColor("#fbbf24");
    } else {
      this.feedbackText?.setText("재화가 부족합니다.").setColor("#fca5a5");
    }
    this.refresh();
  }

  private handleReroll(): void {
    const beforeCurrency = this.flow.runState.runCurrency;
    const cost = getShopRerollCost(this.flow);
    const next = rerollShopOffers(this.flow);
    if (next === this.flow) {
      this.feedbackText?.setText(`리롤에 ${cost}G가 필요합니다.`).setColor("#fca5a5");
      return;
    }

    this.flow = next;
    this.feedbackText?.setText(`상품을 새로 골랐습니다. -${beforeCurrency - next.runState.runCurrency}G`).setColor("#93c5fd");
    this.syncSession();
    this.syncCheckpoint();
    this.refresh();
  }

  private refresh(): void {
    this.statusText?.setText(`보유 재화: ${this.flow.runState.runCurrency}G`);
    this.rerollButton?.setText(`리롤 ${getShopRerollCost(this.flow)}G`);

    for (const button of this.offerButtons) button.destroy();
    this.offerButtons = [];
    this.flow.offers.forEach((offer, index) => {
      const purchased = this.flow.purchasedOfferIds.has(offer.id);
      const owned = this.flow.runState.inventory.itemInstances.includes(offer.equipmentId);
      const status = purchased ? "구매 완료" : owned ? "보유 중" : "";
      const button = this.add.text(36, 142 + index * 52, `${formatShopOfferLabel(offer)}${status ? ` · ${status}` : ""}`, {
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        color: purchased || owned ? "#9ca3af" : "#f9fafb",
        backgroundColor: purchased || owned ? "#1f2937" : "#243247",
        padding: { x: 12, y: 8 },
      });
      if (!purchased && !owned) {
        button.setInteractive({ useHandCursor: true });
        button.on("pointerdown", () => this.handlePurchase(offer));
      }
      this.offerButtons.push(button);
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
      shopRerollCount: this.flow.rerollCount,
    });
  }
}
