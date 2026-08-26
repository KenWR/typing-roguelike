import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
  type RunState,
} from "@typing-roguelike/shared";
import { settleDeadRun } from "../src/game/settlement/death-settlement";
import type { PersistentWalletSnapshot } from "../src/game/settlement/persistent-wallet";

const emptyWallet = (): PersistentWalletSnapshot => ({
  totalCurrency: 0,
  settledRunIds: [],
});

const createDeadRun = (equipmentIds: readonly string[]): RunState => {
  const run = createInitialRunState({ seed: 153 });
  return {
    ...run,
    status: "dead",
    inventory: {
      ...run.inventory,
      itemInstances: [...equipmentIds],
    },
    loadout: {
      ...run.loadout,
      weaponId: equipmentIds[0] ?? null,
      subweaponId: equipmentIds[1] ?? null,
    },
  };
};

describe("death settlement", () => {
  test("exchanges every owned equipment item and does not add a clear bonus", () => {
    const equipment = EQUIPMENT_CONFIGS.slice(0, 2);
    const run = createDeadRun(equipment.map(({ id }) => id));

    const result = settleDeadRun(run, emptyWallet());
    const expectedTotal = equipment.reduce(
      (total, item) => total + item.sellValue,
      0,
    );

    expect(result.applied).toBe(true);
    expect(result.items).toEqual(
      equipment.map(({ id, sellValue }) => ({ equipmentId: id, sellValue })),
    );
    expect(result.itemExchangeCurrency).toBe(expectedTotal);
    expect(result.clearRewardCurrency).toBe(0);
    expect(result.totalCurrency).toBe(expectedTotal);
    expect(result.wallet.totalCurrency).toBe(expectedTotal);
  });

  test("removes settled run equipment and clears loadout slots", () => {
    const equipmentIds = EQUIPMENT_CONFIGS.slice(0, 2).map(({ id }) => id);
    const result = settleDeadRun(createDeadRun(equipmentIds), emptyWallet());

    expect(result.runState.status).toBe("dead");
    expect(result.runState.inventory.itemInstances).toEqual([]);
    expect(result.runState.loadout).toEqual({
      weaponId: null,
      subweaponId: null,
      ring1Id: null,
      ring2Id: null,
    });
    expect(result.runState.acquiredItemValue).toBe(0);
  });

  test("does not pay the same run twice", () => {
    const equipmentIds = [EQUIPMENT_CONFIGS[0]!.id];
    const run = createDeadRun(equipmentIds);
    const first = settleDeadRun(run, emptyWallet());
    const second = settleDeadRun(run, first.wallet);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.wallet).toEqual(first.wallet);
  });

  test("rejects settlement for a run that is not dead", () => {
    const run = createInitialRunState({ seed: 154 });
    expect(() => settleDeadRun(run, emptyWallet())).toThrow(
      "Death settlement requires a dead run.",
    );
  });
});
