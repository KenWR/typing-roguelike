import type { RunState } from "@typing-roguelike/shared";
import { settleClearedRun } from "./clear-settlement";
import { settleDeadRun } from "./death-settlement";
import type { PersistentWalletSnapshot } from "./persistent-wallet";
import type { SettlementPresentationInput } from "./settlement-view-state";

export const DEFAULT_CLEAR_REWARD_CURRENCY = 600;

export type PreparedRunSettlement = Readonly<{
  applied: boolean;
  presentation: SettlementPresentationInput;
  totalCurrency: number;
  runState: Readonly<RunState>;
  wallet: PersistentWalletSnapshot;
}>;

export const prepareRunSettlement = (
  runState: Readonly<RunState>,
  wallet: PersistentWalletSnapshot,
  clearRewardCurrency = DEFAULT_CLEAR_REWARD_CURRENCY,
): PreparedRunSettlement => {
  if (runState.status === "dead") {
    const settlement = settleDeadRun(runState, wallet);
    return {
      applied: settlement.applied,
      presentation: {
        outcome: "death",
        itemExchangeCurrency: settlement.itemExchangeCurrency,
        clearRewardCurrency: settlement.clearRewardCurrency,
      },
      totalCurrency: settlement.totalCurrency,
      runState: settlement.runState,
      wallet: settlement.wallet,
    };
  }

  if (runState.status === "cleared") {
    const settlement = settleClearedRun(
      runState,
      wallet,
      clearRewardCurrency,
    );
    return {
      applied: settlement.applied,
      presentation: {
        outcome: "clear",
        itemExchangeCurrency: settlement.summary.itemValue,
        clearRewardCurrency: settlement.summary.clearBonus,
      },
      totalCurrency: settlement.summary.totalPayout,
      runState: settlement.runState,
      wallet: settlement.wallet,
    };
  }

  throw new Error("Run settlement requires a dead or cleared run.");
};
