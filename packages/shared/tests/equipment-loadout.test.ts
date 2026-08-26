import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  applyEquipmentAcquisition,
  createInitialRunState,
  getCombatLoadoutOptions,
  isTwoHandedWeapon,
  selectCombatLoadout,
} from "../src/index.ts";

describe("equipment carry and combat loadout rules", () => {
  test("keeps one item per weapon category and replaces the equipped item", () => {
    const oneHanded = EQUIPMENT_CONFIGS.find(
      (equipment) => equipment.slot === "weapon" && !isTwoHandedWeapon(equipment),
    )!;
    const secondOneHanded = EQUIPMENT_CONFIGS.find(
      (equipment) =>
        equipment.slot === "weapon" &&
        !isTwoHandedWeapon(equipment) &&
        equipment.id !== oneHanded.id,
    )!;
    const twoHanded = EQUIPMENT_CONFIGS.find(isTwoHandedWeapon)!;
    const subweapon = EQUIPMENT_CONFIGS.find(
      (equipment) => equipment.slot === "subweapon",
    )!;

    let runState = createInitialRunState({ seed: 91 });
    runState = applyEquipmentAcquisition(runState, oneHanded);
    runState = applyEquipmentAcquisition(runState, subweapon);
    runState = applyEquipmentAcquisition(runState, twoHanded);
    runState = applyEquipmentAcquisition(runState, secondOneHanded);

    expect(runState.inventory.itemInstances).toEqual([
      subweapon.id,
      twoHanded.id,
      secondOneHanded.id,
    ]);
    expect(runState.inventory.itemInstances).not.toContain(oneHanded.id);
    expect(runState.loadout.weaponId).toBe(secondOneHanded.id);
    expect(runState.loadout.subweaponId).toBe(subweapon.id);
  });

  test("offers one-handed plus subweapon or two-handed combat loadouts", () => {
    const oneHanded = EQUIPMENT_CONFIGS.find(
      (equipment) => equipment.slot === "weapon" && !isTwoHandedWeapon(equipment),
    )!;
    const twoHanded = EQUIPMENT_CONFIGS.find(isTwoHandedWeapon)!;
    const subweapon = EQUIPMENT_CONFIGS.find(
      (equipment) => equipment.slot === "subweapon",
    )!;

    let runState = createInitialRunState({ seed: 92 });
    for (const equipment of [oneHanded, twoHanded, subweapon]) {
      runState = applyEquipmentAcquisition(runState, equipment);
    }

    expect(getCombatLoadoutOptions(runState)).toEqual([
      { mode: "one-handed", weaponId: oneHanded.id, subweaponId: subweapon.id },
      { mode: "two-handed", weaponId: twoHanded.id, subweaponId: null },
    ]);
    expect(selectCombatLoadout(runState, "two-handed").loadout).toMatchObject({
      weaponId: twoHanded.id,
      subweaponId: null,
    });
  });
});
