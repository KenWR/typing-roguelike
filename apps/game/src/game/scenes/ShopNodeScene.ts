import Phaser from "phaser";
import { ownsShopOffer, type GeneratedMapNode, type RunState, type ShopOffer } from "@typing-roguelike/shared";
import { TEXTURE_KEYS } from "../assets/asset-catalog";
import { playCoinSound, playRuntimeBgm } from "../audio/runtime-audio";
import { getEquippedEquipment, formatEquipmentInfo } from "../equipment/equipment-info";
import { RUN_RESUME_CHECKPOINT_VERSION } from "../run/run-resume-checkpoint";
import { runSession } from "../run/run-session";
import { getShopOfferHoverDetails } from "../shop/shop-offer-details";
import {
  createShopModalInputGuardLayout,
  stopShopModalPointerPropagation,
} from "../shop/shop-modal-input-guard";
import { formatShopOfferLabel } from "../shop/shop-offer-label";
import { completeShopNode, createShopNodeFlow, getShopRerollCost, purchaseShopOffer, rerollShopOffers, type ShopNodeFlowState } from "../shop/shop-node-flow";

const SHOP_OFFER_TOP = 142;
const SHOP_OFFER_ROW_HEIGHT = 52;
const TOOLTIP_WIDTH = 390;
const TOOLTIP_MIN_HEIGHT = 178;
const TOOLTIP_IMAGE_SIZE = 112;
const TOOLTIP_PADDING = 20;

const RARITY_LABELS: Readonly<Record<string, string>> = {
  common: "일반",
  uncommon: "고급",
  rare: "희귀",
  epic: "영웅",
  legendary: "전설",
  hidden: "숨김",
};

export type ShopNodeSceneData = Readonly<{ runState: RunState; nodeId: string; node?: GeneratedMapNode; nextNodeIds: readonly string[]; offers?: readonly ShopOffer[]; purchasedOfferIds?: readonly string[]; rerollCount?: number }>;

export class ShopNodeScene extends Phaser.Scene {
  private flow!: ShopNodeFlowState;
  private node?: GeneratedMapNode;
  private statusText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private rerollButton?: Phaser.GameObjects.Text;
  private exitButton?: Phaser.GameObjects.Text;
  private offerButtons: Phaser.GameObjects.Text[] = [];
  private equipmentModal?: Phaser.GameObjects.Container;
  private offerTooltip?: Phaser.GameObjects.Container;

  constructor() { super("ShopScene"); }

  init(data: ShopNodeSceneData): void {
    this.node = data.node;
    this.flow = createShopNodeFlow(data.runState, data.nodeId, data.nextNodeIds, data.offers, data.purchasedOfferIds, data.rerollCount ?? 0);
    this.syncCheckpoint();
  }

  create(): void {
    playRuntimeBgm("tower");
    const { width, height } = this.scale.gameSize;
    const background = this.add.image(width / 2, height / 2, TEXTURE_KEYS.shopBackground);
    background.setScale(Math.max(width / background.width, height / background.height));
    this.add.rectangle(0, 0, width, height, 0x08101b, 0.3).setOrigin(0);
    this.add.text(36, 32, "상점", { fontFamily: "Galmuri9, monospace", fontSize: "30px", color: "#f9fafb" });
    this.statusText = this.add.text(36, 76, "", { fontFamily: "Galmuri9, monospace", fontSize: "18px", color: "#f5cf72" });
    this.feedbackText = this.add.text(36, 108, "", { fontFamily: "Galmuri9, monospace", fontSize: "15px", color: "#9ca3af" });

    const equipmentButton = this.add.text(420, 32, "현재 장비 정보", { fontFamily: "Galmuri9, monospace", fontSize: "18px", color: "#f9fafb", backgroundColor: "#374151", padding: { x: 12, y: 9 } }).setInteractive({ useHandCursor: true });
    equipmentButton.on("pointerdown", () => this.toggleEquipmentModal());

    this.rerollButton = this.add.text(36, 0, "", { fontFamily: "Galmuri9, monospace", fontSize: "18px", color: "#f9fafb", backgroundColor: "#374151", padding: { x: 14, y: 9 } }).setInteractive({ useHandCursor: true });
    this.rerollButton.on("pointerdown", () => this.handleReroll());
    this.exitButton = this.add.text(220, 0, "상점 나가기", { fontFamily: "Galmuri9, monospace", fontSize: "18px", color: "#f9fafb", backgroundColor: "#1f6f68", padding: { x: 14, y: 9 } }).setInteractive({ useHandCursor: true });
    this.exitButton.once("pointerdown", () => {
      this.hideOfferTooltip();
      this.flow = completeShopNode(this.flow); this.syncSession(); runSession.clearCheckpoint(); this.scene.start("MapScene", { runState: this.flow.runState });
    });
    this.refresh();
  }

  private toggleEquipmentModal(): void {
    this.hideOfferTooltip();
    if (this.equipmentModal !== undefined) { this.equipmentModal.destroy(); this.equipmentModal = undefined; return; }
    const { width, height } = this.scale.gameSize;
    const panel = this.add.container(0, 0).setDepth(1000);
    const blockerLayout = createShopModalInputGuardLayout(width, height);
    const inputBlocker = this.add
      .rectangle(
        blockerLayout.x,
        blockerLayout.y,
        blockerLayout.width,
        blockerLayout.height,
        0x000000,
        0.001,
      )
      .setInteractive();
    inputBlocker.on(
      Phaser.Input.Events.POINTER_DOWN,
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => stopShopModalPointerPropagation(() => event.stopPropagation()),
    );
    panel.add(inputBlocker);
    panel.add(this.add.rectangle(width / 2, height / 2, Math.min(width - 80, 760), Math.min(height - 80, 600), 0x111827, 0.98).setStrokeStyle(2, 0x6b7280));
    panel.add(this.add.text(width / 2, 80, "현재 장비", { fontFamily: "Galmuri9, monospace", fontSize: "28px", color: "#f9fafb" }).setOrigin(0.5));
    const equipped = getEquippedEquipment(this.flow.runState);
    const text = equipped.length === 0 ? "장착한 장비가 없습니다." : equipped.map(formatEquipmentInfo).join("\n\n────────────\n\n");
    panel.add(this.add.text(width / 2 - 330, 125, text, { fontFamily: "Galmuri9, monospace", fontSize: "15px", color: "#e5e7eb", wordWrap: { width: 660 }, maxLines: 25 }));
    const close = this.add.text(width / 2, height - 70, "닫기", { fontFamily: "Galmuri9, monospace", fontSize: "18px", color: "#ffffff", backgroundColor: "#374151", padding: { x: 18, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => { this.equipmentModal?.destroy(); this.equipmentModal = undefined; });
    panel.add(close);
    this.equipmentModal = panel;
  }

  private handlePurchase(offer: ShopOffer): void {
    this.hideOfferTooltip();
    const beforeCurrency = this.flow.runState.runCurrency;
    this.flow = purchaseShopOffer(this.flow, offer.id);
    const purchased = this.flow.purchasedOfferIds.has(offer.id) && this.flow.runState.runCurrency < beforeCurrency;
    if (purchased) { playCoinSound(); this.feedbackText?.setText(offer.kind === "relic" ? "유물을 장착했습니다." : "구매 완료").setColor("#86efac"); this.syncSession(); this.syncCheckpoint(); }
    else if (this.flow.purchasedOfferIds.has(offer.id)) this.feedbackText?.setText("이미 구매한 상품입니다.").setColor("#fbbf24");
    else if (ownsShopOffer(this.flow.runState, offer)) this.feedbackText?.setText(offer.kind === "relic" ? "이미 보유한 유물입니다." : "이미 보유한 장비입니다.").setColor("#fbbf24");
    else this.feedbackText?.setText("골드가 부족합니다.").setColor("#fca5a5");
    this.refresh();
  }

  private handleReroll(): void {
    this.hideOfferTooltip();
    const beforeCurrency = this.flow.runState.runCurrency; const cost = getShopRerollCost(this.flow); const next = rerollShopOffers(this.flow);
    if (next === this.flow) { this.feedbackText?.setText(`리롤에 ${cost}G가 필요합니다.`).setColor("#fca5a5"); return; }
    this.flow = next; this.feedbackText?.setText(`상품을 새로 골랐습니다. -${beforeCurrency - next.runState.runCurrency}G`).setColor("#93c5fd"); this.syncSession(); this.syncCheckpoint(); this.refresh();
  }

  private showOfferTooltip(offer: ShopOffer, anchor: Phaser.Geom.Rectangle): void {
    this.hideOfferTooltip();
    if (this.equipmentModal !== undefined) return;

    const details = getShopOfferHoverDetails(offer);
    const { width, height } = this.scale.gameSize;
    const tooltip = this.add.container(0, 0).setDepth(900);
    const panel = this.add.rectangle(0, 0, TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT, 0x0f172a, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, 0x64748b);
    tooltip.add(panel);

    if (details.textureKey !== undefined && this.textures.exists(details.textureKey)) {
      tooltip.add(
        this.add.rectangle(
          TOOLTIP_PADDING,
          TOOLTIP_PADDING,
          TOOLTIP_IMAGE_SIZE,
          TOOLTIP_IMAGE_SIZE,
          0x1e293b,
          1,
        ).setOrigin(0).setStrokeStyle(1, 0x475569),
      );
      const image = this.add.image(
        TOOLTIP_PADDING + TOOLTIP_IMAGE_SIZE / 2,
        TOOLTIP_PADDING + TOOLTIP_IMAGE_SIZE / 2,
        details.textureKey,
      );
      const scale = Math.min(
        (TOOLTIP_IMAGE_SIZE - 12) / image.width,
        (TOOLTIP_IMAGE_SIZE - 12) / image.height,
        1.5,
      );
      image.setScale(scale);
      tooltip.add(image);
    } else {
      tooltip.add(this.add.rectangle(TOOLTIP_PADDING, TOOLTIP_PADDING, TOOLTIP_IMAGE_SIZE, TOOLTIP_IMAGE_SIZE, 0x1f2937, 1).setOrigin(0).setStrokeStyle(1, 0x475569));
      tooltip.add(this.add.text(TOOLTIP_PADDING + TOOLTIP_IMAGE_SIZE / 2, TOOLTIP_PADDING + TOOLTIP_IMAGE_SIZE / 2, "이미지\n없음", { fontFamily: "Galmuri9, monospace", fontSize: "14px", color: "#94a3b8", align: "center" }).setOrigin(0.5));
    }

    const textX = TOOLTIP_PADDING + TOOLTIP_IMAGE_SIZE + 20;
    const textWidth = TOOLTIP_WIDTH - textX - TOOLTIP_PADDING;
    const name = this.add.text(textX, 18, details.name, { fontFamily: "Galmuri9, monospace", fontSize: "20px", color: "#f8fafc", wordWrap: { width: textWidth } });
    tooltip.add(name);
    const meta = this.add.text(textX, name.y + name.height + 8, `${details.kindLabel} · ${RARITY_LABELS[details.rarity] ?? details.rarity}`, { fontFamily: "Galmuri9, monospace", fontSize: "14px", color: "#f5cf72" });
    tooltip.add(meta);
    const description = this.add.text(textX, meta.y + meta.height + 10, details.description, { fontFamily: "Galmuri9, monospace", fontSize: "14px", lineSpacing: 3, color: "#e2e8f0", wordWrap: { width: textWidth } });
    tooltip.add(description);
    const price = this.add.text(TOOLTIP_PADDING, TOOLTIP_PADDING + TOOLTIP_IMAGE_SIZE + 12, `${offer.price}G`, { fontFamily: "Galmuri9, monospace", fontSize: "16px", color: "#fde68a" });
    tooltip.add(price);

    const tooltipHeight = Math.max(
      TOOLTIP_MIN_HEIGHT,
      description.y + description.height + 18,
      price.y + price.height + 14,
    );
    panel.setSize(TOOLTIP_WIDTH, tooltipHeight);

    const anchorRight = anchor.x + anchor.width;
    const preferredRightX = anchorRight + 16;
    const preferredLeftX = anchor.x - TOOLTIP_WIDTH - 16;
    const x = preferredRightX + TOOLTIP_WIDTH <= width - 12
      ? preferredRightX
      : Math.max(12, preferredLeftX);
    const y = Math.max(12, Math.min(anchor.y, height - tooltipHeight - 12));
    tooltip.setPosition(x, y);
    this.offerTooltip = tooltip;
  }

  private hideOfferTooltip(): void {
    this.offerTooltip?.destroy();
    this.offerTooltip = undefined;
  }

  private refresh(): void {
    this.hideOfferTooltip();
    this.statusText?.setText(`보유 골드: ${this.flow.runState.runCurrency}G`); this.rerollButton?.setText(`리롤 ${getShopRerollCost(this.flow)}G`);
    for (const button of this.offerButtons) button.destroy(); this.offerButtons = [];
    this.flow.offers.forEach((offer, index) => {
      const purchased = this.flow.purchasedOfferIds.has(offer.id); const owned = ownsShopOffer(this.flow.runState, offer); const status = purchased ? "구매 완료" : owned ? "보유 중" : "";
      const button = this.add.text(36, SHOP_OFFER_TOP + index * SHOP_OFFER_ROW_HEIGHT, `${formatShopOfferLabel(offer)}${status ? ` · ${status}` : ""}`, { fontFamily: "Galmuri9, monospace", fontSize: "18px", color: purchased || owned ? "#9ca3af" : "#f9fafb", backgroundColor: purchased || owned ? "#1f2937" : "#243247", padding: { x: 12, y: 8 } }).setInteractive({ useHandCursor: !purchased && !owned });
      button.on("pointerover", () => this.showOfferTooltip(offer, button.getBounds()));
      button.on("pointerout", () => this.hideOfferTooltip());
      if (!purchased && !owned) button.on("pointerdown", () => this.handlePurchase(offer));
      this.offerButtons.push(button);
    });
    this.layoutActionButtons();
  }

  /** 진열 칸 수가 달라져도 버튼이 상품 목록을 가리지 않도록 목록 아래에 둔다. */
  private layoutActionButtons(): void {
    const actionY = SHOP_OFFER_TOP + this.flow.offers.length * SHOP_OFFER_ROW_HEIGHT + 16;
    this.rerollButton?.setY(actionY);
    this.exitButton?.setY(actionY);
  }

  private syncSession(): void { const active = runSession.get(); if (active?.status === "active") runSession.update(() => this.flow.runState); }
  private syncCheckpoint(): void {
    const node = this.node ?? runSession.getCheckpoint()?.node; if (node === undefined) return;
    runSession.setCheckpoint({ version: RUN_RESUME_CHECKPOINT_VERSION, sceneKey: "ShopScene", node, nextNodeIds: this.flow.nextNodeIds, shopOffers: this.flow.offers, purchasedOfferIds: [...this.flow.purchasedOfferIds], shopRerollCount: this.flow.rerollCount });
  }
}
