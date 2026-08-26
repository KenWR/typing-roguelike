import { ENCOUNTER_CONFIGS } from "../content/encounters.ts";

export const MAP_ROUND_COUNT = 10;
export const MAX_MAP_CHOICES = 3;
export const START_NODE_KEY = "start";

export type MapNodeChoice = 1 | 2 | 3;
export type MapNodeType =
	| "combat"
	| "elite"
	| "reward"
	| "shop"
	| "rest"
	| "boss";
export type MapNodeIconType = MapNodeType;

export interface GeneratedMapNode {
	choice: MapNodeChoice;
	icon: MapNodeIconType;
	iconType: MapNodeIconType;
	key: string;
	parentKey: string;
	nextNodeKeys: string[];
	round: number;
	type: MapNodeType;
	monsterId?: string;
}

export interface GeneratedMapRound {
	round: number;
	nodes: GeneratedMapNode[];
}

export interface GeneratedMap {
	seed: number;
	rounds: GeneratedMapRound[];
}

const NODE_TYPES: readonly MapNodeType[] = [
	"combat",
	"elite",
	"shop",
	"rest",
];
const NODE_CHOICES: readonly MapNodeChoice[] = [1, 2, 3];
const DIAGONAL_EDGES: readonly (readonly [MapNodeChoice, MapNodeChoice])[] = [
	[1, 2],
	[2, 1],
	[2, 3],
	[3, 2],
];

const hash = (value: string): number => {
	let result = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		result ^= value.charCodeAt(index);
		result = Math.imul(result, 16777619);
	}
	return result >>> 0;
};

const shuffle = <T>(values: readonly T[], seed: number): T[] => {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swapIndex = hash(`${seed}:${index}`) % (index + 1);
		[result[index], result[swapIndex]] = [result[swapIndex], result[index]];
	}
	return result;
};

const validateSeed = (seed: number): void => {
	if (!Number.isSafeInteger(seed) || seed < 0) {
		throw new RangeError("Map seed must be a non-negative safe integer.");
	}
};

const validateRound = (round: number): void => {
	if (!Number.isSafeInteger(round) || round < 1 || round > MAP_ROUND_COUNT) {
		throw new RangeError(`Map round must be an integer from 1 to ${MAP_ROUND_COUNT}.`);
	}
};

const validateChoicePath = (round: number, choicePath: readonly number[]): void => {
	if (choicePath.length !== round - 1) {
		throw new RangeError(
			`A round ${round} map choice path must contain ${round - 1} choices.`,
		);
	}
	for (const choice of choicePath) {
		if (!Number.isInteger(choice) || choice < 1 || choice > MAX_MAP_CHOICES) {
			throw new RangeError("Map choices must be integers from 1 to 3.");
		}
	}
};

const nodeKey = (round: number, choice: MapNodeChoice): string => `${round}-${choice}`;

/** Returns the stable key for a node identified by its floor and selected lane. */
export const getMapNodeKey = (round: number, path: readonly number[]): string => {
	validateRound(round);
	if (path.length !== round) {
		throw new RangeError(
			`A round ${round} map node path must contain ${round} choices.`,
		);
	}
	for (const choice of path) {
		if (!Number.isInteger(choice) || choice < 1 || choice > MAX_MAP_CHOICES) {
			throw new RangeError("Map choices must be integers from 1 to 3.");
		}
	}
	return nodeKey(round, path[path.length - 1] as MapNodeChoice);
};

const hasEliteEncounter = (round: number): boolean =>
	ENCOUNTER_CONFIGS.some(
		(encounter) => encounter.floor === round && encounter.nodeType === "elite",
	);

const getNodeTypes = (seed: number, round: number): MapNodeType[] => {
	if (round === 9) return ["rest", "rest", "rest"];
	if (round === MAP_ROUND_COUNT) return ["boss"];

	const candidates = NODE_TYPES.filter((type) => {
		if (round === 1 && type === "shop") return false;
		if (type === "elite" && !hasEliteEncounter(round)) return false;
		return true;
	});

	const ordered = shuffle(candidates, hash(`${seed}:${round}`));
	return Array.from({ length: MAX_MAP_CHOICES }, (_, index) => ordered[index % ordered.length]!);
};

/**
 * Builds a Slay-the-Spire-like sparse transition: every lane keeps one upward
 * route and at most one lane on a floor receives one extra adjacent branch.
 * That guarantees reachability without turning each floor into an all-to-all graph.
 */
const nextChoicesFor = (
	seed: number,
	round: number,
	choice: MapNodeChoice,
): MapNodeChoice[] => {
	if (round >= MAP_ROUND_COUNT) return [];
	if (round === MAP_ROUND_COUNT - 1) return [1];

	const choices: MapNodeChoice[] = [choice];
	const [branchFrom, branchTo] = DIAGONAL_EDGES[hash(`${seed}:edge:${round}`) % DIAGONAL_EDGES.length]!;
	if (choice === branchFrom) choices.push(branchTo);
	return choices;
};

const generateRoundNodes = (
	seed: number,
	round: number,
	monsterIds: readonly string[] = [],
): GeneratedMapNode[] => {
	const types = getNodeTypes(seed, round);
	return types.map((type, index) => {
		const choice = NODE_CHOICES[index]!;
		const key = nodeKey(round, choice);
		const parentChoice = choice;
		const parentKey = round === 1 ? START_NODE_KEY : nodeKey(round - 1, parentChoice);
		const nextNodeKeys = nextChoicesFor(seed, round, choice).map((nextChoice) =>
			nodeKey(round + 1, nextChoice),
		);
		const node: GeneratedMapNode = {
			choice,
			icon: type,
			iconType: type,
			key,
			parentKey,
			nextNodeKeys,
			round,
			type,
		};
		if ((type === "combat" || type === "elite" || type === "boss") && monsterIds.length > 0) {
			node.monsterId = monsterIds[hash(`${seed}:${round}:${choice}`) % monsterIds.length];
		}
		return node;
	});
};

export const generateNodeChoices = (
	seed: number,
	round: number,
	choicePath: readonly number[],
	monsterIds: readonly string[] = [],
): GeneratedMapNode[] => {
	validateSeed(seed);
	validateRound(round);
	validateChoicePath(round, choicePath);

	const nodes = generateRoundNodes(seed, round, monsterIds);
	if (round === 1 || round === MAP_ROUND_COUNT) return nodes;

	const previousChoice = choicePath[choicePath.length - 1] as MapNodeChoice;
	const allowed = new Set(nextChoicesFor(seed, round - 1, previousChoice));
	return nodes.filter((node) => allowed.has(node.choice));
};

/** Generates the complete deterministic fixed-width ten-round map graph. */
export const generateMap = (
	seed: number,
	monsterIds: readonly string[] = [],
): GeneratedMap => {
	validateSeed(seed);
	return {
		seed,
		rounds: Array.from({ length: MAP_ROUND_COUNT }, (_, index) => {
			const round = index + 1;
			return { round, nodes: generateRoundNodes(seed, round, monsterIds) };
		}),
	};
};
