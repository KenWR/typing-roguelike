import type { RunState } from "@typing-roguelike/shared";
import { runSession } from "../run/run-session";
import { SettlementCompletionController } from "../settlement/settlement-completion";
import {
  applySettlementCurrency,
  loadPersistentWallet,
  savePersistentWallet,
} from "../settlement/persistent-wallet";
import type { SettlementPresentationInput } from "../settlement/settlement-view-state";
import { RunResultScene } from "./RunResultScene";

export type CompletableRunResultSceneData = Partial<SettlementPresentationInput> &
  Readonly<{
    runState?: Readonly<RunState>;
    result?: "death" | "clear";
  }>;

export class CompletableRunResultScene extends RunResultScene {
  private settlementRun: Readonly<RunState> | null = null;
  private settlementPayout = 0;

  init(data: CompletableRunResultSceneData = {}): void {
    this.settlementRun = data.runState ?? runSession.get();
    const outcome =
      data.outcome ?? data.result ?? (this.settlementRun?.status === "cleared" ? "clear" : "death");
    const itemExchangeCurrency =
      data.itemExchangeCurrency ?? this.settlementRun?.acquiredItemValue ?? 0;
    const clearRewardCurrency = data.clearRewardCurrency ?? 0;
    this.settlementPayout = itemExchangeCurrency + clearRewardCurrency;

    super.init({ outcome, itemExchangeCurrency, clearRewardCurrency });
  }

  create(): void {
    super.create();
    const { width, height } = this.scale.gameSize;
    const confirm = this.add
      .text(width / 2, height - 34, "정산 확인 · 로비로 돌아가기", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "18px",
        color: "#f9fafb",
        backgroundColor: "#1f6f68",
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });

    confirm.once("pointerdown", () => {
      if (this.settlementRun !== null) {
        const storage = typeof localStorage === "undefined" ? undefined : localStorage;
        const currentWallet = loadPersistentWallet(storage);
        const settlement = applySettlementCurrency(
          currentWallet,
          this.settlementRun,
          this.settlementPayout,
        );
        savePersistentWallet(settlement.wallet, storage);
        new SettlementCompletionController(this.settlementRun).confirm();
      } else {
        runSession.clear();
      }
      confirm.disableInteractive().setText("로비로 이동 중...");
      this.scene.start("LobbyScene");
    });
  }
}
