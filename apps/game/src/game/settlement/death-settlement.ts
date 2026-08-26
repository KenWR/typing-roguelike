import { EQUIPMENT_CONFIGS, type RunState } from "@typing-roguelike/shared";
import {
  applySettlementCurrency,
  type PersistentWalletSnapshot,
} from "./persistent-wallet";

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

const EQUIPMENT_BY_ID = new Map(
  EQUIPMENT_CONFIGS.map((equipment) => [equipment.id, equipment] as const),
);

export const settleDeadRun = (
  runState: Readonly<RunState>,
  wallet: PersistentWalletSnapshot,
): DeathSettlementResult => {
  if (runState.status !== "dead") {
    throw new Error("Death settlement requires a dead run.");
  }

  const items = runState.inventory.itemInstances.map((equipmentId) => {
    const equipment = EQUIPMENT_BY_ID.get(equipmentId);
    if (!equipment) {
      throw new Error(`Unknown equipment in death settlement: ${equipmentId}`);
    }
    return { equipmentId, sellValue: equipment.sellValue } as const;
  });

  const itemExchangeCurrency = items.reduce(
    (total, item) => total + item.sellValue,
    0,
  );
  if (!Number.isSafeInteger(itemExchangeCurrency)) {
    throw new RangeError("Death settlement total must be a safe integer.");
  }

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
