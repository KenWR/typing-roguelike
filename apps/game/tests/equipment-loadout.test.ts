import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS, createInitialRunState, applyEquipmentAcquisition, isTwoHandedWeapon, getCombatLoadoutOptions } from "@typing-roguelike/shared";

describe("combat loadout choices", () => {
  test("exposes only the loadouts supported by owned equipment", () => {
    const weapon = EQUIPMENT_CONFIGS.find((equipment) => equipment.slot === "weapon" && !isTwoHandedWeapon(equipment))!;
    const runState = applyEquipmentAcquisition(createInitialRunState({ seed: 93 }), weapon);
    expect(getCombatLoadoutOptions(runState)).toEqual([
      { mode: "one-handed", weaponId: weapon.id, subweaponId: null },
    ]);
  });
});
