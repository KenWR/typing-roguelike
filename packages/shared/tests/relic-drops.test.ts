import { describe, expect, test } from "bun:test";
import { RELIC_CONFIGS } from "../src/content/relics.ts";
import { createInitialRunState } from "../src/contracts/backend/run-state.ts";
import {
	BASE_RELIC_RARITY_WEIGHTS,
	RELIC_PRICE_BY_RARITY,
	applyRelicAcquisition,
	createRelicDropTable,
	generateRelicRewardCandidates,
	getRelicPrice,
	getRelicPriceById,
	ownsRelic,
} from "../src/rules/relic-drops.ts";

/** 0, 1/4, 2/4, 3/4 를 반복하는 결정적 난수. */
const cyclingRandom = (values: readonly number[]): (() => number) => {
	let index = 0;
	return () => values[index++ % values.length]!;
};

describe("relic prices", () => {
	test("prices every relic rarity that can appear", () => {
		for (const relic of RELIC_CONFIGS) {
			expect(getRelicPrice(relic)).toBe(RELIC_PRICE_BY_RARITY[relic.rarity as never]);
			expect(getRelicPrice(relic)).toBeGreaterThan(0);
		}
	});

	test("keeps prices ordered by rarity", () => {
		expect(RELIC_PRICE_BY_RARITY.common).toBeLessThan(RELIC_PRICE_BY_RARITY.uncommon);
		expect(RELIC_PRICE_BY_RARITY.uncommon).toBeLessThan(RELIC_PRICE_BY_RARITY.rare);
		expect(RELIC_PRICE_BY_RARITY.rare).toBeLessThan(RELIC_PRICE_BY_RARITY.epic);
		expect(RELIC_PRICE_BY_RARITY.epic).toBeLessThan(RELIC_PRICE_BY_RARITY.legendary);
	});

	test("rejects an unknown relic id", () => {
		expect(() => getRelicPriceById("relic_does_not_exist")).toThrow(RangeError);
	});
});

describe("relic drop table", () => {
	test("turns weights into probabilities that sum to one", () => {
		const table = createRelicDropTable();
		const total = table.reduce((sum, entry) => sum + entry.probability, 0);

		expect(table).toHaveLength(5);
		expect(total).toBeCloseTo(1, 10);
		for (const entry of table) {
			expect(entry.weight).toBe(BASE_RELIC_RARITY_WEIGHTS[entry.rarity]);
		}
	});

	test("honours weight overrides", () => {
		const table = createRelicDropTable({ common: 0, legendary: 100 });

		expect(table.find((entry) => entry.rarity === "common")?.probability).toBe(0);
		expect(
			table.find((entry) => entry.rarity === "legendary")!.probability,
		).toBeGreaterThan(0.5);
	});

	test("rejects a table with no positive weight", () => {
		expect(() =>
			createRelicDropTable({
				common: 0,
				uncommon: 0,
				rare: 0,
				epic: 0,
				legendary: 0,
			}),
		).toThrow(RangeError);
	});
});

describe("relic reward candidates", () => {
	test("returns the requested count without duplicates", () => {
		const candidates = generateRelicRewardCandidates({
			count: 3,
			random: cyclingRandom([0, 0.25, 0.5, 0.75]),
		});

		expect(candidates).toHaveLength(3);
		expect(new Set(candidates.map((relic) => relic.id)).size).toBe(3);
	});

	test("is deterministic for the same random sequence", () => {
		const first = generateRelicRewardCandidates({
			count: 3,
			random: cyclingRandom([0.1, 0.42, 0.77, 0.3]),
		});
		const second = generateRelicRewardCandidates({
			count: 3,
			random: cyclingRandom([0.1, 0.42, 0.77, 0.3]),
		});

		expect(first.map((relic) => relic.id)).toEqual(second.map((relic) => relic.id));
	});

	test("never offers a relic the run already owns", () => {
		const owned = RELIC_CONFIGS.slice(0, 20).map((relic) => relic.id);
		const candidates = generateRelicRewardCandidates({
			count: 5,
			random: cyclingRandom([0, 0.3, 0.6, 0.9]),
			excludedRelicIds: owned,
		});

		expect(candidates.length).toBeGreaterThan(0);
		for (const relic of candidates) {
			expect(owned).not.toContain(relic.id);
		}
	});

	test("returns fewer candidates than requested when the pool runs out", () => {
		const allButTwo = RELIC_CONFIGS.slice(2).map((relic) => relic.id);
		const candidates = generateRelicRewardCandidates({
			count: 5,
			random: cyclingRandom([0, 0.5]),
			excludedRelicIds: allButTwo,
		});

		expect(candidates).toHaveLength(2);
	});

	test("returns nothing for a zero count and rejects a negative count", () => {
		expect(generateRelicRewardCandidates({ count: 0 })).toEqual([]);
		expect(() => generateRelicRewardCandidates({ count: -1 })).toThrow(RangeError);
	});

	test("rejects a random source outside [0, 1)", () => {
		expect(() =>
			generateRelicRewardCandidates({ count: 1, random: () => 1 }),
		).toThrow(RangeError);
	});
});

describe("relic acquisition", () => {
	test("stores the relic and equips it so combat effects apply", () => {
		const relic = RELIC_CONFIGS[0]!;
		const runState = applyRelicAcquisition(createInitialRunState({ seed: 7 }), relic.id);

		expect(runState.inventory.relicInstances).toEqual([relic.id]);
		expect(runState.build.equippedRelicIds).toEqual([relic.id]);
		expect(ownsRelic(runState, relic.id)).toBe(true);
	});

	test("is idempotent for a relic the run already owns", () => {
		const relic = RELIC_CONFIGS[0]!;
		const once = applyRelicAcquisition(createInitialRunState({ seed: 8 }), relic.id);
		const twice = applyRelicAcquisition(once, relic.id);

		expect(twice.inventory.relicInstances).toEqual([relic.id]);
		expect(twice.build.equippedRelicIds).toEqual([relic.id]);
	});

	test("keeps previously acquired relics", () => {
		const [first, second] = RELIC_CONFIGS;
		let runState = applyRelicAcquisition(createInitialRunState({ seed: 9 }), first!.id);
		runState = applyRelicAcquisition(runState, second!.id);

		expect(runState.inventory.relicInstances).toEqual([first!.id, second!.id]);
		expect(runState.build.equippedRelicIds).toEqual([first!.id, second!.id]);
	});

	test("does not mutate the input run state", () => {
		const initial = createInitialRunState({ seed: 10 });
		applyRelicAcquisition(initial, RELIC_CONFIGS[0]!.id);

		expect(initial.inventory.relicInstances).toEqual([]);
		expect(initial.build.equippedRelicIds).toEqual([]);
	});

	test("rejects an unknown relic id", () => {
		expect(() =>
			applyRelicAcquisition(createInitialRunState({ seed: 11 }), "relic_nope"),
		).toThrow(RangeError);
	});
});
