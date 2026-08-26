import { describe, expect, test } from "bun:test";
import {
  BASE_EQUIPMENT_RARITY_WEIGHTS,
  createEquipmentDropTable,
  generateEquipmentRewardCandidates,
  rollEquipmentRarity,
} from "../src/rules/equipment-drops.ts";

describe("equipment drop table", () => {
  test("uses the documented base rarity probabilities and excludes hidden", () => {
    const table = createEquipmentDropTable("normal");

    expect(table.map(({ rarity, weight }) => [rarity, weight])).toEqual([
      ["common", 40],
      ["uncommon", 30],
      ["rare", 20],
      ["epic", 8],
      ["legendary", 2],
    ]);
    expect(table.reduce((sum, entry) => sum + entry.probability, 0)).toBeCloseTo(1);
    expect(table.some(({ rarity }) => rarity === ("hidden" as never))).toBe(false);
    expect(Object.isFrozen(BASE_EQUIPMENT_RARITY_WEIGHTS)).toBe(true);
  });

  test("rolls deterministic rarity boundaries", () => {
    expect(rollEquipmentRarity("normal", () => 0)).toBe("common");
    expect(rollEquipmentRarity("normal", () => 0.4)).toBe("uncommon");
    expect(rollEquipmentRarity("normal", () => 0.7)).toBe("rare");
    expect(rollEquipmentRarity("normal", () => 0.9)).toBe("epic");
    expect(rollEquipmentRarity("normal", () => 0.99)).toBe("legendary");
  });

  test("supports independent encounter tier overrides", () => {
    const overrides = {
      elite: { common: 0, uncommon: 0, rare: 1, epic: 0, legendary: 0 },
      boss: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 1 },
    } as const;

    expect(rollEquipmentRarity("elite", () => 0.5, overrides)).toBe("rare");
    expect(rollEquipmentRarity("boss", () => 0.5, overrides)).toBe("legendary");
    expect(rollEquipmentRarity("normal", () => 0.5, overrides)).toBe("uncommon");
  });

  test("generates distinct non-hidden equipment candidates", () => {
    const values = [0.5, 0, 0.5, 0.5];
    let index = 0;
    const candidates = generateEquipmentRewardCandidates({
      tier: "normal",
      count: 2,
      random: () => values[index++] ?? 0,
    });

    expect(candidates).toHaveLength(2);
    expect(new Set(candidates.map(({ id }) => id)).size).toBe(2);
    expect(candidates.every(({ rarity }) => rarity !== "hidden")).toBe(true);
  });

  test("excludes already owned equipment from reward candidates", () => {
    const first = generateEquipmentRewardCandidates({
      tier: "normal",
      count: 1,
      random: () => 0,
    })[0]!;

    const candidates = generateEquipmentRewardCandidates({
      tier: "normal",
      count: 3,
      random: () => 0,
      excludedEquipmentIds: [first.id],
    });

    expect(candidates).toHaveLength(3);
    expect(candidates.some(({ id }) => id === first.id)).toBe(false);
  });

  test("returns the remaining safe candidates when exclusions exhaust the pool", () => {
    const allCandidates = generateEquipmentRewardCandidates({
      tier: "normal",
      count: Number.MAX_SAFE_INTEGER,
      random: () => 0,
    });
    const remaining = allCandidates.at(-1)!;
    const excludedEquipmentIds = allCandidates.slice(0, -1).map(({ id }) => id);

    const candidates = generateEquipmentRewardCandidates({
      tier: "normal",
      count: 3,
      random: () => 0,
      excludedEquipmentIds,
    });

    expect(candidates.map(({ id }) => id)).toEqual([remaining.id]);
  });

  test("returns an empty fallback instead of re-offering owned equipment", () => {
    const allCandidates = generateEquipmentRewardCandidates({
      tier: "normal",
      count: Number.MAX_SAFE_INTEGER,
      random: () => 0,
    });

    const candidates = generateEquipmentRewardCandidates({
      tier: "normal",
      count: 2,
      random: () => 0,
      excludedEquipmentIds: allCandidates.map(({ id }) => id),
    });

    expect(candidates).toEqual([]);
  });

  test("rejects invalid tables and random values", () => {
    expect(() => createEquipmentDropTable("boss", {
      boss: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    })).toThrow(RangeError);
    expect(() => rollEquipmentRarity("normal", () => 1)).toThrow(RangeError);
    expect(() => generateEquipmentRewardCandidates({ tier: "normal", count: -1 })).toThrow(RangeError);
  });
});
