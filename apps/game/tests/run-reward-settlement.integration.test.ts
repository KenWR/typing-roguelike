import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
  getEquipmentDataModel,
  type RunState,
} from "@typing-roguelike/shared";
import { createRunRewardSelectionFlow } from "../src/game/rewards/run-reward-selection";
import { RunSession } from "../src/game/run/run-session";
import { settleClearedRun } from "../src/game/settlement/clear-settlement";
import { settleDeadRun } from "../src/game/settlement/death-settlement";
import type { PersistentWalletSnapshot } from "../src/game/settlement/persistent-wallet";
import { SettlementCompletionController } from "../src/game/settlement/settlement-completion";

const emptyWallet = (): PersistentWalletSnapshot => ({
  totalCurrency: 0,
  settledRunIds: [],
});

const chooseUnequippedReward = (runState: Readonly<RunState>): string => {
  const equipment = EQUIPMENT_CONFIGS.find(
    ({ id }) => !runState.inventory.itemInstances.includes(id),
  );
  if (equipment === undefined) {
    throw new Error("Expected at least one equipment reward candidate.");
  }
  return equipment.id;
};

const acquireReward = (runState: RunState): RunState => {
  const rewardId = chooseUnequippedReward(runState);
  const flow = createRunRewardSelectionFlow({
    runState,
    equipmentIds: [rewardId],
  });

  flow.adapter.selectReward(rewardId);
  flow.adapter.continue();
  return flow.adapter.getRunState();
};

describe("run reward and settlement integration", () => {
  test("keeps acquired equipment through the active run session", () => {
    const initial = createInitialRunState({ seed: 172 });
    const rewarded = acquireReward(initial);
    const session = new RunSession(undefined);

    session.replace(rewarded);
    const continued = session.require();
    const rewardedId = rewarded.inventory.itemInstances.at(-1)!;

    expect(continued.status).toBe("active");
    expect(continued.inventory.itemInstances).toContain(rewardedId);
    expect(
      continued.loadout.weaponId === rewardedId ||
        continued.loadout.subweaponId === rewardedId,
    ).toBe(true);
  });

  test("death pays only equipment exchange value once and clears the active run after confirmation", () => {
    const rewarded = acquireReward(createInitialRunState({ seed: 173 }));
    const deadRun: RunState = { ...rewarded, status: "dead" };
    const session = new RunSession(undefined);
    session.replace(deadRun);

    const first = settleDeadRun(deadRun, emptyWallet());
    const duplicate = settleDeadRun(deadRun, first.wallet);
    const expectedExchange = deadRun.inventory.itemInstances.reduce((total, id) => {
      const equipment = getEquipmentDataModel(id);
      if (equipment === undefined) throw new Error(`Unknown test equipment: ${id}`);
      return total + equipment.sellValue;
    }, 0);

    expect(first.applied).toBe(true);
    expect(first.itemExchangeCurrency).toBe(expectedExchange);
    expect(first.clearRewardCurrency).toBe(0);
    expect(first.wallet.totalCurrency).toBe(expectedExchange);
    expect(first.runState.inventory.itemInstances).toEqual([]);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.wallet.totalCurrency).toBe(expectedExchange);

    const completion = new SettlementCompletionController(first.runState, session);
    expect(completion.confirm().applied).toBe(true);
    expect(session.get()).toBeNull();
    expect(completion.confirm().applied).toBe(false);
  });

  test("clear separates exchange value and clear bonus and reflects the total in persistent currency", () => {
    const rewarded = acquireReward(createInitialRunState({ seed: 174 }));
    const clearedRun: RunState = { ...rewarded, status: "cleared" };
    const session = new RunSession(undefined);
    session.replace(clearedRun);
    const clearBonus = 250;

    const first = settleClearedRun(clearedRun, emptyWallet(), clearBonus);
    const duplicate = settleClearedRun(clearedRun, first.wallet, clearBonus);
    const expectedItemValue = clearedRun.inventory.itemInstances.reduce((total, id) => {
      const equipment = getEquipmentDataModel(id);
      if (equipment === undefined) throw new Error(`Unknown test equipment: ${id}`);
      return total + equipment.sellValue;
    }, 0);

    expect(first.applied).toBe(true);
    expect(first.summary.itemValue).toBe(expectedItemValue);
    expect(first.summary.clearBonus).toBe(clearBonus);
    expect(first.summary.totalPayout).toBe(expectedItemValue + clearBonus);
    expect(first.wallet.totalCurrency).toBe(expectedItemValue + clearBonus);
    expect(first.runState.inventory.itemInstances).toEqual([]);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.wallet.totalCurrency).toBe(first.wallet.totalCurrency);

    new SettlementCompletionController(first.runState, session).confirm();
    expect(session.get()).toBeNull();
  });
});
