import type { RunState } from "@typing-roguelike/shared";
import { runRemotePersistence } from "../run/run-remote-persistence";
import { runSession } from "../run/run-session";
import { SettlementCompletionController } from "../settlement/settlement-completion";
import {
  loadPersistentWallet,
  savePersistentWallet,
} from "../settlement/persistent-wallet";
import {
  DEFAULT_CLEAR_REWARD_CURRENCY,
  prepareRunSettlement,
} from "../settlement/run-settlement";
import type { SettlementPresentationInput } from "../settlement/settlement-view-state";
import { SCENE_KEYS } from "./scene-contract";
import { RunResultScene } from "./RunResultScene";

export type CompletableRunResultSceneData = Partial<SettlementPresentationInput> &
  Readonly<{
    runState?: Readonly<RunState>;
    result?: "death" | "clear";
  }>;

export class CompletableRunResultScene extends RunResultScene {
  private settlementRun: Readonly<RunState> | null = null;
  private clearRewardCurrency = DEFAULT_CLEAR_REWARD_CURRENCY;
  private settlementInProgress = false;

  init(data: CompletableRunResultSceneData = {}): void {
    this.settlementRun = data.runState ?? runSession.get();
    this.settlementInProgress = false;
    this.clearRewardCurrency =
      data.clearRewardCurrency ?? DEFAULT_CLEAR_REWARD_CURRENCY;

    if (
      this.settlementRun?.status === "dead" ||
      this.settlementRun?.status === "cleared"
    ) {
      const storage = typeof localStorage === "undefined" ? undefined : localStorage;
      const settlement = prepareRunSettlement(
        this.settlementRun,
        loadPersistentWallet(storage),
        this.clearRewardCurrency,
      );
      super.init(settlement.presentation);
      return;
    }

    const outcome = data.outcome ?? data.result ?? "death";
    const itemExchangeCurrency =
      data.itemExchangeCurrency ?? this.settlementRun?.acquiredItemValue ?? 0;
    const clearRewardCurrency = data.clearRewardCurrency ?? 0;

    super.init({ outcome, itemExchangeCurrency, clearRewardCurrency });
  }

  create(): void {
    super.create();
    const { width, height } = this.scale.gameSize;
    const confirm = this.add
      .text(width / 2, height - 34, "정산 확인 · 메인 화면으로 돌아가기", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "18px",
        color: "#f9fafb",
        backgroundColor: "#1f6f68",
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });

    confirm.on("pointerdown", async () => {
      if (this.settlementInProgress) return;
      const showRetry = (message: string): void => {
        this.settlementInProgress = false;
        confirm
          .setText(message)
          .setInteractive({ useHandCursor: true });
      };
      this.settlementInProgress = true;
      confirm.disableInteractive().setText("정산 저장 중...");
      try {
        if (this.settlementRun !== null) {
          const completed = await runRemotePersistence.complete(this.settlementRun);
          if (!completed) {
            showRetry("서버 정산 저장 실패 · 다시 시도");
            return;
          }
          const storage = typeof localStorage === "undefined" ? undefined : localStorage;
          if (
            this.settlementRun.status === "dead" ||
            this.settlementRun.status === "cleared"
          ) {
            const settlement = prepareRunSettlement(
              this.settlementRun,
              loadPersistentWallet(storage),
              this.clearRewardCurrency,
            );
            if (!savePersistentWallet(settlement.wallet, storage)) {
              showRetry("로컬 정산 저장 실패 · 다시 시도");
              return;
            }
            new SettlementCompletionController(settlement.runState).confirm();
          } else {
            new SettlementCompletionController(this.settlementRun).confirm();
          }
        } else {
          runSession.clear();
        }
        confirm.setText("메인 화면으로 이동 중...");
        this.scene.start(SCENE_KEYS.start);
      } catch {
        showRetry("정산 처리 실패 · 다시 시도");
      }
    });
  }
}
