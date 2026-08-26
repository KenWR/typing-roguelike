import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS } from "../src/content/equipment.ts";
import {
  EQUIPMENT_DATA_MODELS,
  createEquipmentDataModel,
  getEquipmentDataModel,
  getEquipmentSkill,
} from "../src/content/equipment-model.ts";
import type { EquipmentConfig } from "../src/content/types.ts";

describe("equipment data model", () => {
  test("exposes required equipment fields and stable asset references", () => {
    expect(EQUIPMENT_DATA_MODELS).toHaveLength(EQUIPMENT_CONFIGS.length);

    for (const equipment of EQUIPMENT_DATA_MODELS) {
      expect(equipment.id.length).toBeGreaterThan(0);
      expect(equipment.name.length).toBeGreaterThan(0);
      expect(equipment.sellValue).toBeGreaterThanOrEqual(0);
      expect(equipment.rarity.length).toBeGreaterThan(0);
      expect(equipment.assetKey).toBe(`equipment:${equipment.id}`);
      expect(getEquipmentDataModel(equipment.id)).toBe(equipment);
    }
  });

  test("links basic, guard, and signature skills explicitly", () => {
    const source: EquipmentConfig = {
      id: "equipment_test",
      name: "테스트 장비",
      slot: "weapon",
      kind: "sword",
      rarity: "rare",
      sellValue: 42,
      baseAttack: 7,
      skills: [
        {
          id: "skill-basic",
          name: "기본기",
          command: "기본기",
          kind: "attack",
          category: "basic",
          apCost: 1,
          windupMs: 100,
          recoveryMs: 100,
          description: "기본 공격",
        },
        {
          id: "skill-guard",
          name: "방어기",
          command: "방어기",
          kind: "defense",
          category: "guard",
          apCost: 1,
          windupMs: 50,
          recoveryMs: 50,
          description: "기본 방어",
        },
        {
          id: "skill-signature",
          name: "시그니처",
          command: "시그니처",
          kind: "attack",
          category: "special",
          apCost: 3,
          windupMs: 300,
          recoveryMs: 200,
          description: "고유 기술",
        },
      ],
    };

    const model = createEquipmentDataModel(source);

    expect(model.skillLinks.basic).toEqual(["skill-basic", "skill-guard"]);
    expect(model.skillLinks.signature).toEqual(["skill-signature"]);
    expect(model.sellValue).toBe(42);
    expect(model.rarity).toBe("rare");
    expect(model.baseAttack).toBe(7);
    expect(getEquipmentSkill(model, "skill-signature")?.name).toBe("시그니처");
  });

  test("keeps the derived model isolated from mutable source skill arrays", () => {
    const source: EquipmentConfig = {
      id: "equipment_clone_test",
      name: "복제 테스트",
      slot: "subweapon",
      kind: "shield",
      rarity: "common",
      sellValue: 5,
      skills: [
        {
          id: "skill-guard",
          name: "막기",
          command: "막기",
          kind: "defense",
          category: "guard",
          apCost: 1,
          windupMs: 0,
          recoveryMs: 0,
          description: "막기",
          tags: ["defense"],
        },
      ],
    };

    const model = createEquipmentDataModel(source);

    expect(model.skills).not.toBe(source.skills);
    expect(model.skills[0]).not.toBe(source.skills[0]);
    expect(model.skills[0]?.tags).not.toBe(source.skills[0]?.tags);
  });
});
