import { describe, expect, test } from "bun:test";
import { createInitialRunState, EQUIPMENT_CONFIGS } from "@typing-roguelike/shared";
import {
  formatEquipmentInfo,
  formatEquipmentSkillDetails,
  getEquippedEquipment,
  getEquipmentHandLabel,
} from "../src/game/equipment/equipment-info";

describe("equipment info", () => {
  test("returns configured equipment for the current loadout", () => {
    const equipment = EQUIPMENT_CONFIGS[0];
    if (equipment === undefined) throw new Error("equipment fixture missing");
    const runState = createInitialRunState({ seed: 1 });
    const equipped = getEquippedEquipment({ ...runState, loadout: { ...runState.loadout, weaponId: equipment.id } });
    expect(equipped.map((item) => item.id)).toContain(equipment.id);
  });

  test("formats equipment name and skill descriptions", () => {
    const equipment = EQUIPMENT_CONFIGS[0];
    if (equipment === undefined) throw new Error("equipment fixture missing");
    const skill = equipment.skills[0];
    if (skill === undefined) throw new Error("skill fixture missing");
    const text = formatEquipmentInfo(equipment);
    expect(text).toContain(equipment.name);
    expect(text).toContain(skill.name);
    expect(text).toContain(skill.description);
  });

  test("labels one-handed and two-handed weapons and exposes skill costs and damage", () => {
    const oneHanded = EQUIPMENT_CONFIGS.find(
      (candidate) => candidate.slot === "weapon" && candidate.kind !== "greatsword",
    );
    const twoHanded = EQUIPMENT_CONFIGS.find(
      (candidate) => candidate.slot === "weapon" && candidate.kind === "greatsword",
    );
    if (oneHanded === undefined || twoHanded === undefined) {
      throw new Error("weapon fixtures missing");
    }
    const firstSkill = oneHanded.skills[0];
    if (firstSkill === undefined) throw new Error("weapon skill fixture missing");
    const oneHandedDetails = formatEquipmentSkillDetails(oneHanded);

    expect(getEquipmentHandLabel(oneHanded)).toBe("한손무기");
    expect(getEquipmentHandLabel(twoHanded)).toBe("양손무기");
    expect(oneHandedDetails).toContain("기본기술");
    expect(oneHandedDetails).toContain("특수기술");
    expect(oneHandedDetails).toContain(`command: ${firstSkill.command}`);
    expect(oneHandedDetails).toContain(`cost: ${firstSkill.apCost}`);
    expect(oneHandedDetails).toContain(
      `damage: ${firstSkill.damage ?? `${Math.round((firstSkill.damageCoefficient ?? 0) * 100)}%`}`,
    );
  });
});
