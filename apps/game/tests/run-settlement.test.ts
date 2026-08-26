import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
  type RunState,
} from "@typing-roguelike/shared";
import type { PersistentWalletSnapshot } from "../src/game/settlement/persistent-wallet";
import {
  DEFAULT_CLEAR_REWARD_CURRENCY,
  prepareRunSettlement,
} from "../src/game/settlement/run-settlement";

const emptyWallet = (): PersistentWalletSnapshot => ({
  totalCurrency: 0,
  settledRunIds: [],
});

const createTerminalRun = (
  status: Extract<RunState["status"], "dead" | "cleared">,
  seed: number,
): RunState => {
  const run = createInitialRunState({ seed });
  const equipmentIds = EQUIPMENT_CONFIGS.slice(0, 2).map(({ id }) => id);
  return {
    ...run,
    status,
    acquiredItemValue: 999,
    inventory: {
      ...run.inventory,
      itemInstances: equipmentIds,
    },
    loadout: {
      ...run.loadout,
      weaponId: equipmentIds[0]!,
      subweaponId: equipmentIds[1]!,
    },
  };
};

describe("result-scene run settlement", () => {
  test("derives death equipment exchange from the owned equipment", () => {
    const run = createTerminalRun("dead", 301);
    const expectedItemValue = EQUIPMENT_CONFIGS.slice(0, 2).reduce(
      (sum, equipment) => sum + equipment.sellValue,
      0,
    );

    const settlement = prepareRunSettlement(run, emptyWallet());

    expect(settlement.presentation).toEqual({
      outcome: "death",
      itemExchangeCurrency: expectedItemValue,
      clearRewardCurrency: 0,
    });
    expect(settlement.totalCurrency).toBe(expectedItemValue);
    expect(settlement.wallet.totalCurrency).toBe(expectedItemValue);
    expect(settlement.runState.inventory.itemInstances).toEqual([]);
  });

  test("pays equipment exchange plus the default clear reward", () => {
    const run = createTerminalRun("cleared", 302);
    const expectedItemValue = EQUIPMENT_CONFIGS.slice(0, 2).reduce(
      (sum, equipment) => sum + equipment.sellValue,
      0,
    );

    const settlement = prepareRunSettlement(run, emptyWallet());

    expect(settlement.presentation).toEqual({
      outcome: "clear",
      itemExchangeCurrency: expectedItemValue,
      clearRewardCurrency: DEFAULT_CLEAR_REWARD_CURRENCY,
    });
    expect(settlement.totalCurrency).toBe(
      expectedItemValue + DEFAULT_CLEAR_REWARD_CURRENCY,
    );
    expect(settlement.wallet.totalCurrency).toBe(settlement.totalCurrency);
    expect(settlement.runState.inventory.itemInstances).toEqual([]);
  });

  test("keeps wallet payout idempotent when the result is reopened", () => {
    const run = createTerminalRun("cleared", 303);
    const first = prepareRunSettlement(run, emptyWallet());
    const reopened = prepareRunSettlement(run, first.wallet);

    expect(first.applied).toBe(true);
    expect(reopened.applied).toBe(false);
    expect(reopened.wallet).toEqual(first.wallet);
  });
});
