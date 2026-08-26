import type { RunLoadoutState } from "../contracts/backend/run-state.ts";
import type { SkillConfig } from "../content/types.ts";
import {
  LOADOUT_SLOTS,
  getLoadoutSlotItemType,
  type LoadoutItemType,
  type LoadoutSlot,
} from "./loadout-slots.ts";

export type LoadoutSkillSource = Readonly<{
  itemId: string;
  itemType: LoadoutItemType;
  skills: readonly SkillConfig[];
}>;

export type AvailableSkill = Readonly<{
  skill: SkillConfig;
  sourceItemIds: readonly string[];
  sourceSlots: readonly LoadoutSlot[];
}>;

const normalizeId = (name: string, value: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new RangeError(`${name} must not be empty.`);
  }
  return normalized;
};

const createSourceMap = (
  sources: readonly LoadoutSkillSource[],
): ReadonlyMap<string, LoadoutSkillSource> => {
  const byItemId = new Map<string, LoadoutSkillSource>();

  for (const source of sources) {
    const itemId = normalizeId("Loadout skill source item id", source.itemId);
    if (byItemId.has(itemId)) {
      throw new Error(`Duplicate loadout skill source: ${itemId}`);
    }
    byItemId.set(itemId, source);
  }

  return byItemId;
};

export const composeAvailableSkills = (
  loadout: Readonly<RunLoadoutState>,
  sources: readonly LoadoutSkillSource[],
): readonly AvailableSkill[] => {
  const sourceByItemId = createSourceMap(sources);
  const availableBySkillId = new Map<
    string,
    { skill: SkillConfig; sourceItemIds: string[]; sourceSlots: LoadoutSlot[] }
  >();

  for (const slot of LOADOUT_SLOTS) {
    const itemId = loadout[slot];
    if (itemId === null) {
      continue;
    }

    const source = sourceByItemId.get(itemId);
    if (source === undefined) {
      continue;
    }

    const expectedItemType = getLoadoutSlotItemType(slot);
    if (source.itemType !== expectedItemType) {
      throw new RangeError(
        `Loadout item ${itemId} is ${source.itemType}, but ${slot} requires ${expectedItemType}.`,
      );
    }

    for (const skill of source.skills) {
      const skillId = normalizeId("Skill id", skill.id);
      const existing = availableBySkillId.get(skillId);

      if (existing === undefined) {
        availableBySkillId.set(skillId, {
          skill,
          sourceItemIds: [itemId],
          sourceSlots: [slot],
        });
        continue;
      }

      existing.sourceItemIds.push(itemId);
      existing.sourceSlots.push(slot);
    }
  }

  return Array.from(availableBySkillId.values(), (entry) => ({
    skill: entry.skill,
    sourceItemIds: [...entry.sourceItemIds],
    sourceSlots: [...entry.sourceSlots],
  }));
};

export const getAvailableSkillIds = (
  loadout: Readonly<RunLoadoutState>,
  sources: readonly LoadoutSkillSource[],
): readonly string[] =>
  composeAvailableSkills(loadout, sources).map(({ skill }) => skill.id);
