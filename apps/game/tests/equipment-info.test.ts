import { describe, expect, test } from "bun:test";
import { createInitialRunState, EQUIPMENT_CONFIGS } from "@typing-roguelike/shared";
import { formatEquipmentInfo, getEquippedEquipment } from "../src/game/equipment/equipment-info";

describe("equipment info", () => {
  test("returns configured equipment for the current loadout", () => {
    const equipment = EQUIPMENT_CONFIGS[0]!;
    const runState = createInitialRunState({ seed: 1 });
    const equipped = getEquippedEquipment({ ...runState, loadout: { ...runState.loadout, weaponId: equipment.id } });
    expect(equipped.map((item) => item.id)).toContain(equipment.id);
  });

  test("formats equipment name and skill descriptions", () => {
    const equipment = EQUIPMENT_CONFIGS[0]!;
    const text = formatEquipmentInfo(equipment);
    expect(text).toContain(equipment.name);
    expect(text).toContain(equipment.skills[0]!.name);
    expect(text).toContain(equipment.skills[0]!.description);
  });
});
