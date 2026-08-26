import { describe, expect, test } from "bun:test";
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
	test("models ten rounds with at most three destinations per parent", () => {
		const map = generateMap(20260826);

		expect(map.rounds).toHaveLength(MAP_ROUND_COUNT);
		expect(map.rounds.map(({ round }) => round)).toEqual(
			Array.from({ length: MAP_ROUND_COUNT }, (_, index) => index + 1),
		);
		const nodes = map.rounds.flatMap(({ nodes: roundNodes }) => roundNodes);
		expect(nodes.length).toBeGreaterThan(0);
		expect(new Set(nodes.map(({ key }) => key)).size).toBe(nodes.length);
		expect(nodes.every(({ nextNodeKeys }) => nextNodeKeys.length <= MAX_MAP_CHOICES)).toBe(true);
		expect(map.rounds.at(-1)?.nodes.every(({ nextNodeKeys }) => nextNodeKeys.length === 0)).toBe(true);
		const nodesByKey = new Map(nodes.map((node) => [node.key, node]));
		for (const node of nodes) {
			for (const nextNodeKey of node.nextNodeKeys) {
				expect(nodesByKey.get(nextNodeKey)?.parentKey).toBe(node.key);
			}
		}
	});

	test("applies the first, recovery, and boss round rules", () => {
		const firstRound = generateNodeChoices(1234, 1, []);
		const recoveryRound = generateNodeChoices(1234, 9, pathForRound(9));
		const bossRound = generateNodeChoices(1234, 10, pathForRound(10));

		expect(firstRound).toHaveLength(3);
		expect(firstRound.every(({ type }) => type !== "shop")).toBe(true);
		expect(recoveryRound.map(({ type }) => type)).toEqual(["rest", "rest", "rest"]);
		expect(bossRound).toHaveLength(1);
		expect(bossRound[0]?.type).toBe("boss");
		expect(bossRound[0]?.iconType).toBe("boss");
		expect(recoveryRound.every(({ nextNodeKeys }) => nextNodeKeys.length === 1)).toBe(true);
	});

	test("exposes reward and semantic icon values", () => {
		const nodes = Array.from({ length: 32 }, (_, seed) =>
			generateNodeChoices(seed, 2, [1]),
		).flat();
		const types = new Set(nodes.map(({ type }) => type));

		expect(types.has("reward")).toBe(true);
		expect(nodes.every(({ icon, iconType, type }) => icon === type && iconType === type)).toBe(true);
	});

	test("keeps generation deterministic and links each node to its real branches", () => {
		const seed = 77;
		const rootChoices = generateNodeChoices(seed, 1, []);
		const root = rootChoices[0]!;
		const childChoices = generateNodeChoices(seed, 2, [root.choice]);
		const siblingChoices = generateNodeChoices(seed, 2, [rootChoices[1]!.choice]);

		expect(generateNodeChoices(seed, 2, [root.choice])).toEqual(childChoices);
		expect(new Set(childChoices.map(({ key }) => key)).size).toBe(3);
		expect(childChoices.every(({ parentKey }) => parentKey === root.key)).toBe(true);
		expect(root.nextNodeKeys).toEqual(childChoices.map(({ key }) => key));
		expect(siblingChoices.map(({ key }) => key)).not.toEqual(childChoices.map(({ key }) => key));
		expect(childChoices[0]?.nextNodeKeys).toEqual(
			generateNodeChoices(seed, 3, [root.choice, childChoices[0]!.choice]).map(({ key }) => key),
		);
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
