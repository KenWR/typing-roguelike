import { RELIC_CONFIGS } from "../content/relics.ts";
import type { Rarity, RelicConfig } from "../content/types.ts";
import type { RunState } from "../contracts/backend/run-state.ts";

export type RelicDropRarity = Exclude<Rarity, "hidden">;
export type RelicRarityWeights = Readonly<Record<RelicDropRarity, number>>;

export interface RelicDropEntry {
	rarity: RelicDropRarity;
	weight: number;
	probability: number;
}

export interface RelicRewardOptions {
	count?: number;
	random?: () => number;
	weightOverrides?: Readonly<Partial<RelicRarityWeights>>;
	excludedRelicIds?: readonly string[];
}

const DROP_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

/** 장비 상점가(sellValue x 2)와 같은 구간을 사용합니다. */
export const RELIC_PRICE_BY_RARITY: RelicRarityWeights = Object.freeze({
	common: 90,
	uncommon: 120,
	rare: 180,
	epic: 360,
	legendary: 720,
});

/** 장비 보상과 같은 초기 확률을 사용합니다. */
export const BASE_RELIC_RARITY_WEIGHTS: RelicRarityWeights = Object.freeze({
	common: 40,
	uncommon: 30,
	rare: 20,
	epic: 8,
	legendary: 2,
});

const isDropRarity = (rarity: Rarity): rarity is RelicDropRarity =>
	rarity !== "hidden";

const getRandomValue = (random: () => number): number => {
	const value = random();
	if (!Number.isFinite(value) || value < 0 || value >= 1) {
		throw new RangeError(`Relic drop random value must be in [0, 1): ${value}`);
	}
	return value;
};

export const getRelicPrice = (relic: RelicConfig): number => {
	if (!isDropRarity(relic.rarity)) {
		throw new RangeError(`Relic ${relic.id} has no purchasable rarity.`);
	}
	return RELIC_PRICE_BY_RARITY[relic.rarity];
};

export const getRelicPriceById = (relicId: string): number => {
	const relic = RELIC_CONFIGS.find((candidate) => candidate.id === relicId);
	if (relic === undefined) throw new RangeError(`Unknown relic: ${relicId}`);
	return getRelicPrice(relic);
};

export const createRelicDropTable = (
	weightOverrides: Readonly<Partial<RelicRarityWeights>> = {},
): readonly RelicDropEntry[] => {
	const weighted = DROP_RARITIES.map((rarity) => {
		const weight = weightOverrides[rarity] ?? BASE_RELIC_RARITY_WEIGHTS[rarity];
		if (!Number.isFinite(weight) || weight < 0) {
			throw new RangeError(`Invalid relic drop weight for ${rarity}: ${weight}`);
		}
		return { rarity, weight };
	});
	const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
	if (totalWeight <= 0) {
		throw new RangeError("Relic drop table has no positive weight");
	}

	return weighted.map(({ rarity, weight }) => ({
		rarity,
		weight,
		probability: weight / totalWeight,
	}));
};

/**
 * 보유하지 않은 유물 중에서 희귀도 가중치에 따라 후보를 뽑습니다.
 * 남은 희귀도가 없으면 요청한 개수보다 적게 돌려줍니다.
 */
export const generateRelicRewardCandidates = ({
	count = 2,
	random = Math.random,
	weightOverrides = {},
	excludedRelicIds = [],
}: RelicRewardOptions = {}): readonly RelicConfig[] => {
	if (!Number.isSafeInteger(count) || count < 0) {
		throw new RangeError(`Relic reward count must be a non-negative integer: ${count}`);
	}

	const excludedIds = new Set(excludedRelicIds);
	const available = RELIC_CONFIGS.filter(
		(relic) => isDropRarity(relic.rarity) && !excludedIds.has(relic.id),
	);
	const table = createRelicDropTable(weightOverrides);
	const candidates: RelicConfig[] = [];

	while (candidates.length < count && available.length > 0) {
		const eligibleEntries = table.filter(
			({ rarity, weight }) =>
				weight > 0 && available.some((relic) => relic.rarity === rarity),
		);
		const eligibleWeight = eligibleEntries.reduce((sum, entry) => sum + entry.weight, 0);
		if (eligibleWeight <= 0) break;

		const rarityRoll = getRandomValue(random) * eligibleWeight;
		let cumulativeWeight = 0;
		const selectedEntry =
			eligibleEntries.find((entry) => {
				cumulativeWeight += entry.weight;
				return rarityRoll < cumulativeWeight;
			}) ?? eligibleEntries.at(-1)!;

		const matchingIndexes = available
			.map((relic, index) => (relic.rarity === selectedEntry.rarity ? index : -1))
			.filter((index) => index >= 0);
		const selectedIndex =
			matchingIndexes[Math.floor(getRandomValue(random) * matchingIndexes.length)]!;
		candidates.push(available[selectedIndex]!);
		available.splice(selectedIndex, 1);
	}

	return candidates;
};

/** 모든 유물의 maxStacks 가 1 이므로 보유 여부만으로 획득 가능 여부를 판단합니다. */
export const ownsRelic = (
	runState: Readonly<RunState>,
	relicId: string,
): boolean => runState.inventory.relicInstances.includes(relicId);

/**
 * 유물을 획득해 즉시 장착합니다.
 *
 * 유물 장착 슬롯 UI 가 아직 없으므로 보유와 장착을 함께 처리해야 전투 효과가
 * 실제로 적용됩니다. 이미 보유한 유물이면 상태를 그대로 돌려줍니다.
 */
export const applyRelicAcquisition = (
	runState: Readonly<RunState>,
	relicId: string,
): RunState => {
	const relic = RELIC_CONFIGS.find((candidate) => candidate.id === relicId);
	if (relic === undefined) throw new RangeError(`Unknown relic: ${relicId}`);
	if (ownsRelic(runState, relicId)) return runState as RunState;

	return {
		...runState,
		inventory: {
			...runState.inventory,
			relicInstances: [...runState.inventory.relicInstances, relicId],
		},
		build: {
			...runState.build,
			equippedRelicIds: runState.build.equippedRelicIds.includes(relicId)
				? [...runState.build.equippedRelicIds]
				: [...runState.build.equippedRelicIds, relicId],
		},
	};
};
