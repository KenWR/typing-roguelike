import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_FIXTURE,
  createEquipmentAdapter,
  type EquipmentSnapshot,
} from "../src/game/equipment/equipment-adapter";
import {
  diffEquipmentSkills,
  getEquippedSkills,
} from "../src/game/equipment/equipment-skill-diff";

const skillIds = (snapshot: EquipmentSnapshot): string[] =>
  getEquippedSkills(snapshot).map((skill) => skill.id);

describe("equipment skill diff", () => {
  test("collects skills from the currently equipped items", () => {
    expect(skillIds(EQUIPMENT_FIXTURE)).toEqual([
      "emberline-slash",
      "emberline-finish",
      "aegis-guard",
      "aegis-counter",
      "echo-memory",
      "star-sigil",
    ]);
  });

  test("returns added and removed skills after a real equipment swap", () => {
    const adapter = createEquipmentAdapter();
    const before = adapter.getSnapshot();
    const after = adapter.equip("weapon", "weapon-voidfang");

    const diff = diffEquipmentSkills(before, after);

    expect(diff.added.map((skill) => skill.id)).toEqual([
      "voidfang-cleave",
      "voidfang-collapse",
    ]);
    expect(diff.removed.map((skill) => skill.id)).toEqual([
      "emberline-slash",
      "emberline-finish",
    ]);
    expect(diff.after.map((skill) => skill.id)).toEqual(skillIds(after));
  });

  test("returns an empty diff when equipment did not change", () => {
    const diff = diffEquipmentSkills(EQUIPMENT_FIXTURE, EQUIPMENT_FIXTURE);

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  test("keeps shared skills when multiple equipped items expose the same skill id", () => {
    const sharedSkill = {
      id: "shared-skill",
      name: "공통 기술",
      command: "공통기술",
      summary: "공통 기술",
    } as const;
    const before: EquipmentSnapshot = {
      equippedBySlot: {
        weapon: "weapon-a",
        offhand: "offhand-a",
        "ring-1": "ring-a",
        "ring-2": "ring-b",
      },
      ownedEquipment: [
        {
          id: "weapon-a",
          slot: "weapon",
          name: "Weapon A",
          rarity: "common",
          iconPath: "weapon-a.png",
          passive: "",
          skills: [sharedSkill],
        },
        {
          id: "weapon-b",
          slot: "weapon",
          name: "Weapon B",
          rarity: "common",
          iconPath: "weapon-b.png",
          passive: "",
          skills: [],
        },
        {
          id: "offhand-a",
          slot: "offhand",
          name: "Offhand A",
          rarity: "common",
          iconPath: "offhand-a.png",
          passive: "",
          skills: [sharedSkill],
        },
        {
          id: "ring-a",
          slot: "ring-1",
          name: "Ring A",
          rarity: "common",
          iconPath: "ring-a.png",
          passive: "",
          skills: [],
        },
        {
          id: "ring-b",
          slot: "ring-2",
          name: "Ring B",
          rarity: "common",
          iconPath: "ring-b.png",
          passive: "",
          skills: [],
        },
      ],
    };
    const after: EquipmentSnapshot = {
      ...before,
      equippedBySlot: {
        ...before.equippedBySlot,
        weapon: "weapon-b",
      },
    };

    const diff = diffEquipmentSkills(before, after);

    expect(diff.removed).toEqual([]);
    expect(diff.after.map((skill) => skill.id)).toContain("shared-skill");
  });
});
