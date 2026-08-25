export type MapNodeType = "combat" | "elite" | "shop" | "rest" | "boss";

export interface GeneratedMapNode {
	choice: 1 | 2 | 3;
	key: string;
	type: MapNodeType;
	monsterId?: string;
}

const NODE_TYPES: MapNodeType[] = ["combat", "elite", "shop", "rest"];

const hash = (value: string): number => {
	let result = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		result ^= value.charCodeAt(index);
		result = Math.imul(result, 16777619);
	}
	return result >>> 0;
};

const shuffle = <T>(values: T[], seed: number): T[] => {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swapIndex = hash(`${seed}:${index}`) % (index + 1);
		[result[index], result[swapIndex]] = [result[swapIndex], result[index]];
	}
	return result;
};

export const generateNodeChoices = (
	seed: number,
	round: number,
	choicePath: number[],
	monsterIds: readonly string[] = [],
): GeneratedMapNode[] => {
	const path = choicePath.join("");
	let types: MapNodeType[];

	if (round === 9) {
		types = ["rest", "rest", "rest"];
	} else if (round === 10) {
		const alternatives = shuffle(NODE_TYPES.filter((type) => type !== "shop"), hash(`${seed}:${path}`));
		types = ["boss", alternatives[0], alternatives[1]];
	} else {
		const candidates = round === 1 ? NODE_TYPES.filter((type) => type !== "shop") : NODE_TYPES;
		types = shuffle(candidates, hash(`${seed}:${path}`)).slice(0, 3);
	}

	return types.map((type, index) => {
		const choice = (index + 1) as 1 | 2 | 3;
		const nodePath = `${path}${choice}`;
		const node: GeneratedMapNode = { choice, key: `${round}-${choice}`, type };
		if ((type === "combat" || type === "elite" || type === "boss") && monsterIds.length > 0) {
			node.monsterId = monsterIds[hash(`${seed}:${nodePath}`) % monsterIds.length];
		}
		return node;
	});
};
