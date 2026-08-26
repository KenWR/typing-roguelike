import {
  getEquipmentDataModel,
  type RunState,
} from "@typing-roguelike/shared";
import {
  applySettlementCurrency,
  type PersistentWalletSnapshot,
} from "./persistent-wallet";

export type ClearSettlementItem = Readonly<{
  equipmentId: string;
  equipmentName: string;
  value: number;
}>;

export type ClearSettlementSummary = Readonly<{
  items: readonly ClearSettlementItem[];
  itemValue: number;
  clearBonus: number;
  totalPayout: number;
}>;

export type ClearSettlementResult = Readonly<{
  applied: boolean;
  summary: ClearSettlementSummary;
  wallet: PersistentWalletSnapshot;
  runState: Readonly<RunState>;
}>;

const validateClearBonus = (clearBonus: number): number => {
  if (!Number.isSafeInteger(clearBonus) || clearBonus < 0) {
    throw new RangeError("Clear bonus must be a non-negative safe integer.");
  }

  return clearBonus;
};

const createItemSettlement = (
  equipmentId: string,
): ClearSettlementItem => {
  const equipment = getEquipmentDataModel(equipmentId);
  if (equipment === undefined) {
    throw new Error(`Unknown equipment id in clear settlement: ${equipmentId}`);
  }

  return {
    equipmentId,
    equipmentName: equipment.name,
    value: equipment.sellValue,
  };
};

const clearSettledEquipment = (
  runState: Readonly<RunState>,
): Readonly<RunState> => ({
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
});

export const settleClearedRun = (
  runState: Readonly<RunState>,
  wallet: PersistentWalletSnapshot,
  clearBonus: number,
): ClearSettlementResult => {
  if (runState.status !== "cleared") {
    throw new Error("Clear settlement requires a cleared run.");
  }

  const validatedClearBonus = validateClearBonus(clearBonus);
  const items = runState.inventory.itemInstances.map(createItemSettlement);
  const itemValue = items.reduce((sum, item) => sum + item.value, 0);
  const totalPayout = itemValue + validatedClearBonus;

  if (!Number.isSafeInteger(totalPayout)) {
    throw new RangeError("Clear settlement payout exceeds safe integer range.");
  }

  const settlement = applySettlementCurrency(wallet, runState, totalPayout);

  return {
    applied: settlement.applied,
    summary: {
      items,
      itemValue,
      clearBonus: validatedClearBonus,
      totalPayout,
    },
    wallet: settlement.wallet,
    runState: clearSettledEquipment(runState),
  };
};
