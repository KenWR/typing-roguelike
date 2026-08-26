import { EQUIPMENT_CONFIGS } from "../content/equipment.ts";
import type { EquipmentConfig, Rarity } from "../content/types.ts";

export type EquipmentDropRarity = Exclude<Rarity, "hidden">;
export type EquipmentRewardTier = "normal" | "elite" | "boss";
export type EquipmentRarityWeights = Readonly<Record<EquipmentDropRarity, number>>;
export type EquipmentTierWeightOverrides = Readonly<
  Partial<Record<EquipmentRewardTier, Readonly<Partial<EquipmentRarityWeights>>>>
>;

export interface EquipmentDropEntry {
  rarity: EquipmentDropRarity;
  weight: number;
  probability: number;
}

export interface EquipmentRewardOptions {
  tier: EquipmentRewardTier;
  count?: number;
  random?: () => number;
  tierWeightOverrides?: EquipmentTierWeightOverrides;
  excludedEquipmentIds?: readonly string[];
}

const DROP_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

/** 장비 문서의 일반 무기 보상 1회 기준 초기 확률입니다. */
export const BASE_EQUIPMENT_RARITY_WEIGHTS: EquipmentRarityWeights = Object.freeze({
  common: 40,
  uncommon: 30,
  rare: 20,
  epic: 8,
  legendary: 2,
});

const assertWeight = (weight: number, rarity: EquipmentDropRarity): void => {
  if (!Number.isFinite(weight) || weight < 0) {
    throw new RangeError(`Invalid equipment drop weight for ${rarity}: ${weight}`);
  }
};

const getRandomValue = (random: () => number): number => {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(`Equipment drop random value must be in [0, 1): ${value}`);
  }
  return value;
};

export const createEquipmentDropTable = (
  tier: EquipmentRewardTier,
  tierWeightOverrides: EquipmentTierWeightOverrides = {},
): readonly EquipmentDropEntry[] => {
  const overrides = tierWeightOverrides[tier] ?? {};
  const weighted = DROP_RARITIES.map((rarity) => {
    const weight = overrides[rarity] ?? BASE_EQUIPMENT_RARITY_WEIGHTS[rarity];
    assertWeight(weight, rarity);
    return { rarity, weight };
  });
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) throw new RangeError(`Equipment drop table for ${tier} has no positive weight`);

  return weighted.map(({ rarity, weight }) => ({
    rarity,
    weight,
    probability: weight / totalWeight,
  }));
};

export const rollEquipmentRarity = (
  tier: EquipmentRewardTier,
  random: () => number = Math.random,
  tierWeightOverrides: EquipmentTierWeightOverrides = {},
): EquipmentDropRarity => {
  const table = createEquipmentDropTable(tier, tierWeightOverrides);
  const roll = getRandomValue(random);
  let cumulativeProbability = 0;
  for (const entry of table) {
    cumulativeProbability += entry.probability;
    if (roll < cumulativeProbability) return entry.rarity;
  }
  return table.at(-1)!.rarity;
};

export const generateEquipmentRewardCandidates = ({
  tier,
  count = 2,
  random = Math.random,
  tierWeightOverrides = {},
  excludedEquipmentIds = [],
}: EquipmentRewardOptions): readonly EquipmentConfig[] => {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(`Equipment reward count must be a non-negative integer: ${count}`);
  }

  const excludedIds = new Set(excludedEquipmentIds);
  const available = EQUIPMENT_CONFIGS.filter(
    (equipment) => equipment.rarity !== "hidden" && !excludedIds.has(equipment.id),
  );
  const table = createEquipmentDropTable(tier, tierWeightOverrides);
  const candidates: EquipmentConfig[] = [];
  while (candidates.length < count && available.length > 0) {
    const eligibleEntries = table.filter(({ rarity, weight }) =>
      weight > 0 && available.some((equipment) => equipment.rarity === rarity)
    );
    const eligibleWeight = eligibleEntries.reduce((sum, entry) => sum + entry.weight, 0);
    if (eligibleWeight <= 0) break;
    const rarityRoll = getRandomValue(random) * eligibleWeight;
    let cumulativeWeight = 0;
    const selectedEntry = eligibleEntries.find((entry) => {
      cumulativeWeight += entry.weight;
      return rarityRoll < cumulativeWeight;
    }) ?? eligibleEntries.at(-1)!;
    const rarity = selectedEntry.rarity;
    const matchingIndexes = available
      .map((equipment, index) => equipment.rarity === rarity ? index : -1)
      .filter((index) => index >= 0);
    const selectedIndex = matchingIndexes[Math.floor(getRandomValue(random) * matchingIndexes.length)]!;
    candidates.push(available[selectedIndex]!);
    available.splice(selectedIndex, 1);
  }
  return candidates;
};
