import { describe, expect, test } from "bun:test";
import { ENCOUNTER_CONFIGS } from "../src/content/encounters";
import {
	generateMap,
	generateNodeChoices,
	getMapNodeKey,
	MAP_ROUND_COUNT,
	MAX_MAP_CHOICES,
} from "../src/rules/map-generation";

const pathForRound = (round: number): number[] =>
	Array.from({ length: round - 1 }, () => 1);

describe("map generation", () => {
	test("models a fixed-width ten-floor graph with at most three nodes per floor", () => {
		const map = generateMap(20260826);

		expect(map.rounds).toHaveLength(MAP_ROUND_COUNT);
		expect(map.rounds.slice(0, -1).every(({ nodes }) => nodes.length <= MAX_MAP_CHOICES)).toBe(true);
		expect(map.rounds.at(-1)?.nodes).toHaveLength(1);
		const nodes = map.rounds.flatMap(({ nodes: roundNodes }) => roundNodes);
		expect(new Set(nodes.map(({ key }) => key)).size).toBe(nodes.length);
		expect(nodes.every(({ nextNodeKeys }) => nextNodeKeys.length <= 2 || nodes.find((node) => node.key === nextNodeKeys[0])?.type === "boss")).toBe(true);
		expect(map.rounds.at(-1)?.nodes[0]?.type).toBe("boss");
	});

	test("applies first-floor, recovery-floor, boss-floor, and no standalone reward rules", () => {
		const firstRound = generateNodeChoices(1234, 1, []);
		const recoveryRound = generateNodeChoices(1234, 9, pathForRound(9));
		const bossRound = generateNodeChoices(1234, 10, pathForRound(10));
		const allNodes = generateMap(1234).rounds.flatMap(({ nodes }) => nodes);

		expect(firstRound).toHaveLength(3);
		expect(firstRound.every(({ type }) => type !== "shop")).toBe(true);
		expect(recoveryRound.every(({ type }) => type === "rest")).toBe(true);
		expect(bossRound).toHaveLength(1);
		expect(bossRound[0]?.type).toBe("boss");
		expect(allNodes.some(({ type }) => type === "reward")).toBe(false);
	});

	test("only offers elite nodes on floors with an elite encounter", () => {
		const eliteFloors = new Set(
			ENCOUNTER_CONFIGS.filter(({ nodeType }) => nodeType === "elite").map(({ floor }) => floor),
		);

		for (let round = 1; round < MAP_ROUND_COUNT; round += 1) {
			if (round === 9) continue;
			const nodes = Array.from({ length: 64 }, (_, seed) =>
				generateMap(seed).rounds[round - 1]!.nodes,
			).flat();

			if (!eliteFloors.has(round)) {
				expect(nodes.some(({ type }) => type === "elite")).toBe(false);
			}
		}
	});

	test("keeps generation deterministic and exposes only connected next-floor choices", () => {
		const seed = 77;
		const root = generateNodeChoices(seed, 1, [])[0]!;
		const children = generateNodeChoices(seed, 2, [root.choice]);

		expect(generateMap(seed)).toEqual(generateMap(seed));
		expect(children.map(({ key }) => key)).toEqual(root.nextNodeKeys);
		expect(children.every(({ round }) => round === 2)).toBe(true);
		expect(getMapNodeKey(2, [3, 2])).toBe("2-2");
	});

	test("creates sparse strictly-upward routes and keeps every lane connected to the boss", () => {
		for (let seed = 0; seed < 32; seed += 1) {
			const map = generateMap(seed);
			const byKey = new Map(map.rounds.flatMap(({ nodes }) => nodes).map((node) => [node.key, node] as const));

			for (const { nodes } of map.rounds.slice(0, -1)) {
				for (const node of nodes) {
					expect(node.nextNodeKeys.length).toBeGreaterThan(0);
				if (node.round < MAP_ROUND_COUNT - 1) {
					expect(node.nextNodeKeys.length).toBeLessThanOrEqual(2);
				}
				for (const nextKey of node.nextNodeKeys) {
					const next = byKey.get(nextKey);
					expect(next).toBeDefined();
					expect(next!.round).toBe(node.round + 1);
				}
			}
			}

			for (const start of map.rounds[0]!.nodes) {
				let frontier = [start.key];
				for (let round = 1; round < MAP_ROUND_COUNT; round += 1) {
					frontier = [...new Set(frontier.flatMap((key) => byKey.get(key)?.nextNodeKeys ?? []))];
				}
				expect(frontier).toContain("10-1");
			}
		}
	});

	test("does not connect every lower node to every upper node", () => {
		const map = generateMap(20260826);
		for (const { nodes } of map.rounds.slice(0, -2)) {
			expect(nodes.every((node) => node.nextNodeKeys.length < MAX_MAP_CHOICES)).toBe(true);
		}
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
