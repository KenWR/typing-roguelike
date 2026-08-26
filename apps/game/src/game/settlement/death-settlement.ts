import type { RunState } from "@typing-roguelike/shared";
import {
  applySettlementCurrency,
  type PersistentWalletSnapshot,
} from "./persistent-wallet";
import {
  calculateRunEquipmentExchangeValue,
  getRunEquipmentForExchange,
} from "./equipment-exchange";

export type DeathSettlementItem = Readonly<{
  equipmentId: string;
  sellValue: number;
}>;

export type DeathSettlementResult = Readonly<{
  applied: boolean;
  items: readonly DeathSettlementItem[];
  itemExchangeCurrency: number;
  clearRewardCurrency: 0;
  totalCurrency: number;
  runState: RunState;
  wallet: PersistentWalletSnapshot;
}>;

export const settleDeadRun = (
  runState: Readonly<RunState>,
  wallet: PersistentWalletSnapshot,
): DeathSettlementResult => {
  if (runState.status !== "dead") {
    throw new Error("Death settlement requires a dead run.");
  }

  const items = getRunEquipmentForExchange(runState).map((equipment) => ({
    equipmentId: equipment.id,
    sellValue: equipment.sellValue,
  }));
  const itemExchangeCurrency = calculateRunEquipmentExchangeValue(runState);

  const payout = applySettlementCurrency(
    wallet,
    runState,
    itemExchangeCurrency,
  );

  if (!payout.applied) {
    return {
      applied: false,
      items,
      itemExchangeCurrency,
      clearRewardCurrency: 0,
      totalCurrency: itemExchangeCurrency,
      runState: runState as RunState,
      wallet: payout.wallet,
    };
  }

  const settledRunState: RunState = {
    ...runState,
    inventory: {
      ...runState.inventory,
      itemInstances: [],
    },
    loadout: {
      weaponId: null,
      subweaponId: null,
      ring1Id: null,
      ring2Id: null,
    },
    acquiredItemValue: 0,
  };

  return {
    applied: true,
    items,
    itemExchangeCurrency,
    clearRewardCurrency: 0,
    totalCurrency: itemExchangeCurrency,
    runState: settledRunState,
    wallet: payout.wallet,
  };
};
