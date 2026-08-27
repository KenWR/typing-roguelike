import { describe, expect, test } from "bun:test";
import {
  createInitialRunState,
  getEquipmentDataModel,
} from "@typing-roguelike/shared";
import { settleClearedRun } from "../src/game/settlement/clear-settlement";
import type { PersistentWalletSnapshot } from "../src/game/settlement/persistent-wallet";

const emptyWallet = (): PersistentWalletSnapshot => ({
  totalCurrency: 0,
  settledRunIds: [],
});

const createClearedRun = () => {
  const runState = createInitialRunState({ seed: 152 });
  runState.status = "cleared";
  runState.inventory.itemInstances = [
    "equipment_blood_sword",
    "equipment_ember_wand",
  ];
  runState.loadout.weaponId = "equipment_blood_sword";
  runState.loadout.subweaponId = "equipment_ember_wand";
  runState.acquiredItemValue = 999;
  return runState;
};

describe("clear settlement", () => {
  test("separates equipment exchange value, clear bonus, and total payout", () => {
    const runState = createClearedRun();
    const bloodSword = getEquipmentDataModel("equipment_blood_sword");
    const emberWand = getEquipmentDataModel("equipment_ember_wand");

    expect(bloodSword).toBeDefined();
    expect(emberWand).toBeDefined();

    const result = settleClearedRun(runState, emptyWallet(), 250);
    const expectedItemValue = bloodSword!.sellValue + emberWand!.sellValue;

    expect(result.applied).toBe(true);
    expect(result.summary.items).toEqual([
      {
        equipmentId: bloodSword!.id,
        equipmentName: bloodSword!.name,
        value: bloodSword!.sellValue,
      },
      {
        equipmentId: emberWand!.id,
        equipmentName: emberWand!.name,
        value: emberWand!.sellValue,
      },
    ]);
    expect(result.summary.itemValue).toBe(expectedItemValue);
    expect(result.summary.clearBonus).toBe(250);
    expect(result.summary.totalPayout).toBe(expectedItemValue + 250);
    expect(result.wallet.totalCurrency).toBe(expectedItemValue + 250);
  });

  test("removes settled run equipment and equipped slots", () => {
    const result = settleClearedRun(createClearedRun(), emptyWallet(), 100);

    expect(result.runState.status).toBe("cleared");
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
    const runState = createClearedRun();
    const first = settleClearedRun(runState, emptyWallet(), 100);
    const second = settleClearedRun(runState, first.wallet, 100);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.wallet).toEqual(first.wallet);
    expect(second.runState.inventory.itemInstances).toEqual([]);
  });

  test("requires a cleared run", () => {
    const runState = createInitialRunState({ seed: 153 });

    expect(() => settleClearedRun(runState, emptyWallet(), 100)).toThrow(
      "Clear settlement requires a cleared run.",
    );
  });

  test("rejects invalid clear bonuses and unknown equipment", () => {
    const runState = createClearedRun();
    expect(() => settleClearedRun(runState, emptyWallet(), -1)).toThrow(
      RangeError,
    );

    runState.inventory.itemInstances = ["equipment_missing"];
    expect(() => settleClearedRun(runState, emptyWallet(), 0)).toThrow(
      "Unknown equipment in run settlement: equipment_missing",
    );
  });
});
