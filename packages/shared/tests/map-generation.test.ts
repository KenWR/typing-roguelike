import { describe, expect, test } from "bun:test";
import { ENCOUNTER_CONFIGS } from "../src/content/encounters";
import { generateMap, generateNodeChoices, getMapNodeKey, MAP_ROUND_COUNT, MAX_MAP_CHOICES } from "../src/rules/map-generation";

const pathForRound = (round: number): number[] => Array.from({ length: round - 1 }, () => 1);

describe("map generation", () => {
	test("models ten rounds with at most three destinations per parent", () => {
		const map = generateMap(20260826);
		expect(map.rounds).toHaveLength(MAP_ROUND_COUNT);
		expect(map.rounds.map(({ round }) => round)).toEqual(Array.from({ length: MAP_ROUND_COUNT }, (_, index) => index + 1));
		const nodes = map.rounds.flatMap(({ nodes: roundNodes }) => roundNodes);
		expect(nodes.length).toBeGreaterThan(0);
		expect(new Set(nodes.map(({ key }) => key)).size).toBe(nodes.length);
		expect(nodes.every(({ nextNodeKeys }) => nextNodeKeys.length <= MAX_MAP_CHOICES)).toBe(true);
		expect(map.rounds.at(-1)?.nodes.every(({ nextNodeKeys }) => nextNodeKeys.length === 0)).toBe(true);
		const nodesByKey = new Map(nodes.map((node) => [node.key, node]));
		for (const node of nodes) for (const nextNodeKey of node.nextNodeKeys) expect(nodesByKey.get(nextNodeKey)?.parentKey).toBe(node.key);
	});

	test("applies the first, recovery, and boss round rules", () => {
		const firstRound = generateNodeChoices(1234, 1, []);
		const recoveryRound = generateNodeChoices(1234, 9, pathForRound(9));
		const bossRound = generateNodeChoices(1234, 10, pathForRound(10));
		expect(firstRound.length).toBeGreaterThan(0);
		expect(firstRound.length).toBeLessThanOrEqual(MAX_MAP_CHOICES);
		expect(firstRound.every(({ type }) => type === "combat" || type === "elite" || type === "rest")).toBe(true);
		expect(recoveryRound).toHaveLength(1);
		expect(recoveryRound[0]?.type).toBe("rest");
		expect(recoveryRound[0]?.nextNodeKeys).toHaveLength(1);
		expect(bossRound).toHaveLength(1);
		expect(bossRound[0]?.type).toBe("boss");
		expect(bossRound[0]?.iconType).toBe("boss");
	});

	test("only offers elite nodes on floors with an elite encounter", () => {
		const eliteFloors = new Set(ENCOUNTER_CONFIGS.filter(({ nodeType }) => nodeType === "elite").map(({ floor }) => floor));
		const generatedEliteFloors = new Set<number>();
		for (let round = 1; round < MAP_ROUND_COUNT; round += 1) {
			if (round === 9) continue;
			const nodes = Array.from({ length: 64 }, (_, seed) => generateNodeChoices(seed, round, pathForRound(round))).flat();
			if (!eliteFloors.has(round)) { expect(nodes.some(({ type }) => type === "elite")).toBe(false); continue; }
			if (nodes.some(({ type }) => type === "elite")) generatedEliteFloors.add(round);
		}
		expect(generatedEliteFloors).toEqual(eliteFloors);
	});

	test("never exposes reward nodes and keeps semantic icon values", () => {
		const nodes = Array.from({ length: 32 }, (_, seed) => generateNodeChoices(seed, 2, [1])).flat();
		expect(nodes.some(({ type }) => type === "reward")).toBe(false);
		expect(nodes.every(({ icon, iconType, type }) => icon === type && iconType === type)).toBe(true);
	});

	test("keeps generation deterministic and links each node to its real branches", () => {
		const seed = 77; const rootChoices = generateNodeChoices(seed, 1, []); const root = rootChoices[0]!;
		const childChoices = generateNodeChoices(seed, 2, [root.choice]); const siblingChoices = generateNodeChoices(seed, 2, [rootChoices[1]!.choice]);
		expect(generateNodeChoices(seed, 2, [root.choice])).toEqual(childChoices);
		expect(new Set(childChoices.map(({ key }) => key)).size).toBe(childChoices.length);
		expect(childChoices.length).toBeGreaterThan(0);
		expect(childChoices.length).toBeLessThanOrEqual(MAX_MAP_CHOICES);
		expect(childChoices.every(({ parentKey }) => parentKey === root.key)).toBe(true);
		expect(root.nextNodeKeys).toEqual(childChoices.map(({ key }) => key));
		expect(siblingChoices.map(({ key }) => key)).not.toEqual(childChoices.map(({ key }) => key));
		expect(childChoices[0]?.nextNodeKeys).toEqual(generateNodeChoices(seed, 3, [root.choice, childChoices[0]!.choice]).map(({ key }) => key));
	});

	test("rejects invalid round and path boundaries", () => {
		expect(() => generateNodeChoices(1, 0, [])).toThrow(RangeError);
		expect(() => generateNodeChoices(1, MAP_ROUND_COUNT + 1, pathForRound(MAP_ROUND_COUNT + 1))).toThrow(RangeError);
		expect(() => generateNodeChoices(1, 1, [1])).toThrow(RangeError);
		expect(() => generateNodeChoices(1, 2, [])).toThrow(RangeError);
		expect(() => generateNodeChoices(1, 2, [0])).toThrow(RangeError);
		expect(() => getMapNodeKey(2, [1])).toThrow(RangeError);
	});
});
