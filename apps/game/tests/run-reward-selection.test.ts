import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS, createInitialRunState } from "@typing-roguelike/shared";
import {
  applyEquipmentReward,
  createRunRewardSelectionFlow,
  getRunAvailableSkills,
} from "../src/game/rewards/run-reward-selection";

describe("run reward equipment flow", () => {
  test("adds and equips a selected weapon and refreshes available skills", () => {
    const weapon = EQUIPMENT_CONFIGS.find((equipment) => equipment.slot === "weapon");
    expect(weapon).toBeDefined();
    const initial = createInitialRunState({ seed: 10 });

    const flow = createRunRewardSelectionFlow({
      runState: initial,
      equipmentIds: [weapon!.id],
    });
    flow.adapter.selectReward(weapon!.id);
    flow.adapter.continue();

    const updated = flow.adapter.getRunState();
    expect(updated.inventory.itemInstances).toContain(weapon!.id);
    expect(updated.loadout.weaponId).toBe(weapon!.id);
    expect(flow.getAvailableSkills().map((skill) => skill.id)).toEqual(
      weapon!.skills.map((skill) => skill.id),
    );
    expect(flow.nextSceneKey).toBe("MapScene");
  });

  test("can skip the reward without changing inventory or loadout", () => {
    const equipment = EQUIPMENT_CONFIGS.find((candidate) => candidate.rarity !== "hidden")!;
    const initial = createInitialRunState({ seed: 11 });
    let continued = false;
    const flow = createRunRewardSelectionFlow({
      runState: initial,
      equipmentIds: [equipment.id],
      onContinue: () => {
        continued = true;
      },
    });

    flow.adapter.skip();

    const updated = flow.adapter.getRunState();
    expect(updated.inventory).toEqual(initial.inventory);
    expect(updated.loadout).toEqual(initial.loadout);
    expect(flow.adapter.getViewState()).toMatchObject({
      selectedRewardId: null,
      status: "continued",
    });
    expect(continued).toBe(true);
  });

  test("fills or replaces the subweapon slot", () => {
    const subweapons = EQUIPMENT_CONFIGS.filter((equipment) => equipment.slot === "subweapon");
    expect(subweapons.length).toBeGreaterThan(0);
    const first = subweapons[0]!;
    const second = subweapons[1] ?? first;
    let runState = createInitialRunState({ seed: 20 });

    runState = applyEquipmentReward(runState, first.id);
    expect(runState.loadout.subweaponId).toBe(first.id);

    runState = applyEquipmentReward(runState, second.id);
    expect(runState.loadout.subweaponId).toBe(second.id);
    expect(runState.inventory.itemInstances).toContain(first.id);
    expect(runState.inventory.itemInstances).toContain(second.id);
  });

  test("confirmation applies only once", () => {
    const equipment = EQUIPMENT_CONFIGS.find((candidate) => candidate.rarity !== "hidden")!;
    const flow = createRunRewardSelectionFlow({
      runState: createInitialRunState({ seed: 30 }),
      equipmentIds: [equipment.id],
    });

    flow.adapter.selectReward(equipment.id);
    flow.adapter.continue();
    const afterFirst = flow.adapter.getRunState();

    expect(() => flow.adapter.continue()).toThrow("already complete");
    expect(flow.adapter.getRunState()).toEqual(afterFirst);
  });

  test("available skills are derived from both equipped weapon slots", () => {
    const weapon = EQUIPMENT_CONFIGS.find((equipment) => equipment.slot === "weapon")!;
    const subweapon = EQUIPMENT_CONFIGS.find((equipment) => equipment.slot === "subweapon")!;
    let runState = createInitialRunState({ seed: 40 });
    runState = applyEquipmentReward(runState, weapon.id);
    runState = applyEquipmentReward(runState, subweapon.id);

    expect(getRunAvailableSkills(runState).map((skill) => skill.id)).toEqual([
      ...weapon.skills.map((skill) => skill.id),
      ...subweapon.skills.map((skill) => skill.id),
    ]);
  });
});
