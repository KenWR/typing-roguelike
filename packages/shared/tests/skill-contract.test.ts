import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createSkillActionDefinition,
  createSkillRegistry,
  defineSkill,
} from "../src/index.ts";

const createAttackSkill = () => ({
  id: "skill.magic-bolt",
  name: "Magic Bolt",
  command: "매직볼트",
  kind: "attack" as const,
  category: "basic" as const,
  apCost: 2,
  windupMs: 300,
  recoveryMs: 450,
  effects: [{ type: "damage" as const, coefficient: 1.5 }],
  description: "Deals magic damage after the projectile arrives.",
});

describe("skill contract", () => {
  test("defines command, AP, timing, and typed effects", () => {
    const skill = defineSkill(createAttackSkill());

    expect(skill).toEqual(createAttackSkill());
    expect(skill.effects[0]).toEqual({
      type: "damage",
      coefficient: 1.5,
    });
  });

  test("normalizes legacy equipment damage coefficients into effects", () => {
    const legacySkill = EQUIPMENT_CONFIGS.find(
      ({ skills }) => skills[0]?.damageCoefficient !== undefined,
    )?.skills[0];

    expect(legacySkill).toBeDefined();
    expect(defineSkill(legacySkill!).effects).toEqual([
      {
        type: "damage",
        coefficient: legacySkill!.damageCoefficient,
      },
    ]);
  });

  test("builds a stable registry for equipment skill references", () => {
    const equipmentSkills = EQUIPMENT_CONFIGS.flatMap(({ skills }) => skills);
    const registry = createSkillRegistry(equipmentSkills);
    const selected = equipmentSkills[0]!;

    expect(registry.get(selected.id)).toEqual(defineSkill(selected));
    expect(() =>
      createSkillRegistry([selected, { ...selected }]),
    ).toThrow("Duplicate skill id");
  });

  test("creates the timing definition consumed by the combat engine", () => {
    expect(
      createSkillActionDefinition(createAttackSkill(), {
        actionId: "action.magic-bolt.1",
        actorId: "player",
        targetId: "slime",
      }),
    ).toEqual({
      id: "action.magic-bolt.1",
      actorId: "player",
      targetId: "slime",
      windupMs: 300,
      recoveryMs: 450,
    });
  });

  test("rejects invalid identifiers, commands, resources, timings, and effects", () => {
    const valid = createAttackSkill();

    expect(() => defineSkill({ ...valid, id: " " })).toThrow(RangeError);
    expect(() => defineSkill({ ...valid, command: "" })).toThrow(RangeError);
    expect(() => defineSkill({ ...valid, apCost: -1 })).toThrow(RangeError);
    expect(() =>
      defineSkill({ ...valid, windupMs: Number.POSITIVE_INFINITY }),
    ).toThrow(RangeError);
    expect(() =>
      defineSkill({
        ...valid,
        effects: [{ type: "damage", coefficient: Number.NaN }],
      }),
    ).toThrow(RangeError);
  });
});
