import { ENCOUNTER_CONFIGS } from "../content/encounters.ts";

export const MAP_ROUND_COUNT = 10;
export const MAX_MAP_CHOICES = 3;
export const START_NODE_KEY = "start";

export type MapNodeChoice = 1 | 2 | 3;
export type MapNodeType = "combat" | "elite" | "reward" | "shop" | "rest" | "boss";
export type MapNodeIconType = MapNodeType;

export interface GeneratedMapNode { choice: MapNodeChoice; icon: MapNodeIconType; iconType: MapNodeIconType; key: string; parentKey: string; nextNodeKeys: string[]; round: number; type: MapNodeType; monsterId?: string; }
export interface GeneratedMapRound { round: number; nodes: GeneratedMapNode[]; }
export interface GeneratedMap { seed: number; rounds: GeneratedMapRound[]; }

const NODE_TYPES: readonly MapNodeType[] = ["combat", "elite", "shop", "rest"];
const NODE_CHOICES: readonly MapNodeChoice[] = [1, 2, 3];

const hash = (value: string): number => { let result = 2166136261; for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); } return result >>> 0; };
const shuffle = <T>(values: readonly T[], seed: number): T[] => { const result = [...values]; for (let index = result.length - 1; index > 0; index -= 1) { const swapIndex = hash(`${seed}:${index}`) % (index + 1); [result[index], result[swapIndex]] = [result[swapIndex], result[index]]; } return result; };
const validateSeed = (seed: number): void => { if (!Number.isSafeInteger(seed) || seed < 0) throw new RangeError("Map seed must be a non-negative safe integer."); };
const validateRound = (round: number): void => { if (!Number.isSafeInteger(round) || round < 1 || round > MAP_ROUND_COUNT) throw new RangeError(`Map round must be an integer from 1 to ${MAP_ROUND_COUNT}.`); };
const validateChoicePath = (round: number, choicePath: readonly number[]): void => { if (choicePath.length !== round - 1) throw new RangeError(`A round ${round} map choice path must contain ${round - 1} choices.`); for (const choice of choicePath) if (!Number.isInteger(choice) || choice < 1 || choice > MAX_MAP_CHOICES) throw new RangeError("Map choices must be integers from 1 to 3."); };
const nodeKey = (round: number, path: readonly number[]): string => `${round}-${path.join("-")}`;

export const getMapNodeKey = (round: number, path: readonly number[]): string => { validateRound(round); if (path.length !== round) throw new RangeError(`A round ${round} map node path must contain ${round} choices.`); for (const choice of path) if (!Number.isInteger(choice) || choice < 1 || choice > MAX_MAP_CHOICES) throw new RangeError("Map choices must be integers from 1 to 3."); return nodeKey(round, path); };
const hasEliteEncounter = (round: number): boolean => ENCOUNTER_CONFIGS.some((encounter) => encounter.floor === round && encounter.nodeType === "elite");

const getNodeTypes = (seed: number, round: number, choicePath: readonly number[]): MapNodeType[] => {
	const path = choicePath.join("");
	if (round === 9) return ["rest"];
	if (round === MAP_ROUND_COUNT) return ["boss"];
	const candidates = NODE_TYPES.filter((type) => {
		if (round === 1 && type === "shop") return false;
		if (type === "elite" && !hasEliteEncounter(round)) return false;
		return true;
	});
	return shuffle(candidates, hash(`${seed}:${path}`)).slice(0, MAX_MAP_CHOICES);
};

export const generateNodeChoices = (seed: number, round: number, choicePath: readonly number[], monsterIds: readonly string[] = []): GeneratedMapNode[] => {
	validateSeed(seed); validateRound(round); validateChoicePath(round, choicePath);
	const types = getNodeTypes(seed, round, choicePath);
	return types.map((type, index) => {
		const choice = NODE_CHOICES[index]!; const fullPath = [...choicePath, choice]; const key = nodeKey(round, fullPath);
		const parentKey = round === 1 ? START_NODE_KEY : nodeKey(round - 1, choicePath);
		const nextNodeKeys = round === MAP_ROUND_COUNT ? [] : round === MAP_ROUND_COUNT - 1 ? [nodeKey(round + 1, [...fullPath, 1])] : NODE_CHOICES.map((nextChoice) => nodeKey(round + 1, [...fullPath, nextChoice]));
		const node: GeneratedMapNode = { choice, icon: type, iconType: type, key, parentKey, nextNodeKeys, round, type };
		if ((type === "combat" || type === "elite" || type === "boss") && monsterIds.length > 0) node.monsterId = monsterIds[hash(`${seed}:${fullPath.join("")}`) % monsterIds.length];
		return node;
	});
};

export const generateMap = (seed: number, monsterIds: readonly string[] = []): GeneratedMap => {
	validateSeed(seed);
	const rounds = Array.from({ length: MAP_ROUND_COUNT }, (_, index) => ({ round: index + 1, nodes: [] as GeneratedMapNode[] } satisfies GeneratedMapRound));
	const visit = (round: number, choicePath: readonly number[]): void => { const nodes = generateNodeChoices(seed, round, choicePath, monsterIds); rounds[round - 1]!.nodes.push(...nodes); if (round < MAP_ROUND_COUNT) for (const node of nodes) visit(round + 1, [...choicePath, node.choice]); };
	visit(1, []); return { seed, rounds };
};
