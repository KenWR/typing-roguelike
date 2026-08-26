import Phaser from "phaser";
import { EQUIPMENT_CONFIGS } from "@typing-roguelike/shared";
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
  private equipmentInfoButton?: Phaser.GameObjects.Text;
  private equipmentInfoOverlay?: Phaser.GameObjects.Container;

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

    this.rerollButton = this.add
      .text(36, 310, "", {
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        color: "#f9fafb",
        backgroundColor: "#374151",
        padding: { x: 14, y: 9 },
      })
      .setInteractive({ useHandCursor: true });
    this.rerollButton.on("pointerdown", () => this.handleReroll());

    this.add
      .text(220, 310, "상점 나가기", {
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        color: "#f9fafb",
        backgroundColor: "#1f6f68",
        padding: { x: 14, y: 9 },
      })
      .setInteractive({ useHandCursor: true })
      .once("pointerdown", () => {
        this.flow = completeShopNode(this.flow);
        this.syncSession();
        runSession.clearCheckpoint();
        this.scene.start("MapScene", { runState: this.flow.runState });
      });

    this.equipmentInfoButton = this.add
      .text(400, 310, "현재 장비 설명", {
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        color: "#f9fafb",
        backgroundColor: "#334155",
        padding: { x: 14, y: 9 },
      })
      .setInteractive({ useHandCursor: true });
    this.equipmentInfoButton.on("pointerdown", () => this.toggleEquipmentInfo());

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
      this.feedbackText?.setText("골드가 부족합니다.").setColor("#fca5a5");
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
    this.feedbackText
      ?.setText(`상품을 새로 골랐습니다. -${beforeCurrency - next.runState.runCurrency}G`)
      .setColor("#93c5fd");
    this.syncSession();
    this.syncCheckpoint();
    this.refresh();
  }

  private refresh(): void {
    this.statusText?.setText(`보유 골드: ${this.flow.runState.runCurrency}G`);
    this.rerollButton?.setText(`리롤 ${getShopRerollCost(this.flow)}G`);

    for (const button of this.offerButtons) button.destroy();
    this.offerButtons = [];
    this.flow.offers.forEach((offer, index) => {
      const purchased = this.flow.purchasedOfferIds.has(offer.id);
      const owned = this.flow.runState.inventory.itemInstances.includes(offer.equipmentId);
      const status = purchased ? "구매 완료" : owned ? "보유 중" : "";
      const button = this.add.text(
        36,
        142 + index * 52,
        `${formatShopOfferLabel(offer)}${status ? ` · ${status}` : ""}`,
        {
          fontFamily: "Galmuri9, monospace",
          fontSize: "18px",
          color: purchased || owned ? "#9ca3af" : "#f9fafb",
          backgroundColor: purchased || owned ? "#1f2937" : "#243247",
          padding: { x: 12, y: 8 },
        },
      );
      if (!purchased && !owned) {
        button.setInteractive({ useHandCursor: true });
        button.on("pointerdown", () => this.handlePurchase(offer));
      }
      this.offerButtons.push(button);
    });
  }

  private toggleEquipmentInfo(): void {
    if (this.equipmentInfoOverlay !== undefined) {
      this.equipmentInfoOverlay.destroy();
      this.equipmentInfoOverlay = undefined;
      this.equipmentInfoButton?.setText("현재 장비 설명");
      return;
    }

    const { width, height } = this.scale.gameSize;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(
      this.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.68)
        .setInteractive(),
    );

    const panelWidth = Math.min(width - 40, 760);
    const panelHeight = Math.min(height - 40, 620);
    overlay.add(
      this.add
        .rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x111827, 1)
        .setStrokeStyle(2, 0x475569, 1),
    );
    overlay.add(
      this.add.text(width / 2, height / 2 - panelHeight / 2 + 24, "현재 장비", {
        fontFamily: "Galmuri9, monospace",
        fontSize: "26px",
        color: "#f9fafb",
      }).setOrigin(0.5, 0),
    );

    const equippedIds = [
      this.flow.runState.loadout.weaponId,
      this.flow.runState.loadout.subweaponId,
      this.flow.runState.loadout.ring1Id,
      this.flow.runState.loadout.ring2Id,
    ].filter((id): id is string => id !== null);
    const equipments = equippedIds
      .map((id) => EQUIPMENT_CONFIGS.find((equipment) => equipment.id === id))
      .filter((equipment): equipment is (typeof EQUIPMENT_CONFIGS)[number] => equipment !== undefined);

    if (equipments.length === 0) {
      overlay.add(
        this.add.text(width / 2, height / 2, "장착한 장비가 없습니다.", {
          fontFamily: "Galmuri9, monospace",
          fontSize: "18px",
          color: "#9ca3af",
        }).setOrigin(0.5),
      );
    } else {
      const columns = panelWidth >= 620 ? 2 : 1;
      const gap = 14;
      const cardWidth = (panelWidth - 40 - gap * (columns - 1)) / columns;
      const cardHeight = Math.min(230, (panelHeight - 110) / Math.ceil(equipments.length / columns) - gap);
      const startX = width / 2 - ((cardWidth * columns + gap * (columns - 1)) / 2) + cardWidth / 2;
      const startY = height / 2 - panelHeight / 2 + 76 + cardHeight / 2;

      equipments.forEach((equipment, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = startX + column * (cardWidth + gap);
        const y = startY + row * (cardHeight + gap);
        overlay.add(
          this.add
            .rectangle(x, y, cardWidth, cardHeight, 0x1f2937, 1)
            .setStrokeStyle(1, 0x475569, 1),
        );
        overlay.add(
          this.add.text(x - cardWidth / 2 + 14, y - cardHeight / 2 + 12, equipment.name, {
            fontFamily: "Galmuri9, monospace",
            fontSize: "17px",
            color: "#f9fafb",
            wordWrap: { width: cardWidth - 28 },
          }),
        );

        let textY = y - cardHeight / 2 + 42;
        for (const skill of equipment.skills) {
          overlay.add(
            this.add.text(x - cardWidth / 2 + 14, textY, `${skill.name} · ${skill.command}`, {
              fontFamily: "Galmuri9, monospace",
              fontSize: "13px",
              color: "#fcd34d",
              wordWrap: { width: cardWidth - 28 },
            }),
          );
          textY += 20;
          overlay.add(
            this.add.text(x - cardWidth / 2 + 14, textY, skill.description, {
              fontFamily: "Galmuri9, monospace",
              fontSize: "12px",
              color: "#d1d5db",
              wordWrap: { width: cardWidth - 28 },
            }),
          );
          textY += 38;
          if (skill.effect !== undefined && skill.effect.length > 0) {
            overlay.add(
              this.add.text(x - cardWidth / 2 + 14, textY, `효과: ${skill.effect}`, {
                fontFamily: "Galmuri9, monospace",
                fontSize: "11px",
                color: "#93c5fd",
                wordWrap: { width: cardWidth - 28 },
              }),
            );
            textY += 34;
          }
        }
      });
    }

    const close = this.add
      .text(width / 2, height / 2 + panelHeight / 2 - 26, "닫기", {
        fontFamily: "Galmuri9, monospace",
        fontSize: "16px",
        color: "#f9fafb",
        backgroundColor: "#374151",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.toggleEquipmentInfo());
    overlay.add(close);

    this.equipmentInfoOverlay = overlay;
    this.equipmentInfoButton?.setText("장비 설명 닫기");
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
