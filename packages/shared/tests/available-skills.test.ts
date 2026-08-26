import { describe, expect, test } from "bun:test";
import {
  composeAvailableSkills,
  getAvailableSkillIds,
  type LoadoutSkillSource,
} from "../src/rules/available-skills.ts";
import type { RunLoadoutState } from "../src/contracts/backend/run-state.ts";
import type { SkillConfig } from "../src/content/types.ts";

const createSkill = (id: string, name = id): SkillConfig => ({
  id,
  name,
  command: name,
  kind: "attack",
  category: "basic",
  apCost: 1,
  windupMs: 100,
  recoveryMs: 100,
  description: name,
});

const EMPTY_LOADOUT: RunLoadoutState = {
  weaponId: null,
  subweaponId: null,
  ring1Id: null,
  ring2Id: null,
};

describe("available skills", () => {
  test("combines weapon, subweapon, and both ring skill sources in slot order", () => {
    const loadout: RunLoadoutState = {
      weaponId: "weapon-a",
      subweaponId: "sub-a",
      ring1Id: "ring-a",
      ring2Id: "ring-b",
    };
    const sources: LoadoutSkillSource[] = [
      { itemId: "ring-b", itemType: "ring", skills: [createSkill("ring-b-skill")] },
      { itemId: "weapon-a", itemType: "weapon", skills: [createSkill("slash")] },
      { itemId: "ring-a", itemType: "ring", skills: [createSkill("ring-a-skill")] },
      { itemId: "sub-a", itemType: "subweapon", skills: [createSkill("guard")] },
    ];

    expect(getAvailableSkillIds(loadout, sources)).toEqual([
      "slash",
      "guard",
      "ring-a-skill",
      "ring-b-skill",
    ]);
  });

  test("deduplicates a skill while preserving every equipped source", () => {
    const sharedSkill = createSkill("shared");
    const loadout: RunLoadoutState = {
      ...EMPTY_LOADOUT,
      weaponId: "weapon-a",
      ring1Id: "ring-a",
    };

    const result = composeAvailableSkills(loadout, [
      { itemId: "weapon-a", itemType: "weapon", skills: [sharedSkill] },
      { itemId: "ring-a", itemType: "ring", skills: [sharedSkill] },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.skill.id).toBe("shared");
    expect(result[0]?.sourceItemIds).toEqual(["weapon-a", "ring-a"]);
    expect(result[0]?.sourceSlots).toEqual(["weaponId", "ring1Id"]);
  });

  test("recomputing after replacement removes old-only skills and keeps shared skills", () => {
    const sharedSkill = createSkill("shared");
    const sources: LoadoutSkillSource[] = [
      {
        itemId: "weapon-old",
        itemType: "weapon",
        skills: [sharedSkill, createSkill("old-only")],
      },
      {
        itemId: "weapon-new",
        itemType: "weapon",
        skills: [sharedSkill, createSkill("new-only")],
      },
      {
        itemId: "ring-a",
        itemType: "ring",
        skills: [sharedSkill],
      },
    ];

    const before: RunLoadoutState = {
      ...EMPTY_LOADOUT,
      weaponId: "weapon-old",
      ring1Id: "ring-a",
    };
    const after: RunLoadoutState = {
      ...before,
      weaponId: "weapon-new",
    };

    expect(getAvailableSkillIds(before, sources)).toEqual(["shared", "old-only"]);
    expect(getAvailableSkillIds(after, sources)).toEqual(["shared", "new-only"]);
  });

  test("ignores equipped ids whose skill source is not loaded yet", () => {
    const loadout: RunLoadoutState = {
      ...EMPTY_LOADOUT,
      ring1Id: "future-ring",
    };

    expect(composeAvailableSkills(loadout, [])).toEqual([]);
  });

  test("rejects a source whose item type does not match its equipped slot", () => {
    const loadout: RunLoadoutState = {
      ...EMPTY_LOADOUT,
      weaponId: "wrong-type",
    };

    expect(() =>
      composeAvailableSkills(loadout, [
        { itemId: "wrong-type", itemType: "ring", skills: [createSkill("skill")] },
      ]),
    ).toThrow(RangeError);
  });

  test("rejects duplicate source item ids", () => {
    expect(() =>
      composeAvailableSkills(EMPTY_LOADOUT, [
        { itemId: "duplicate", itemType: "weapon", skills: [] },
        { itemId: "duplicate", itemType: "weapon", skills: [] },
      ]),
    ).toThrow("Duplicate loadout skill source");
  });
});
