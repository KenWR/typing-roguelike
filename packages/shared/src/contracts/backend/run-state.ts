export const RUN_STATE_SCHEMA_VERSION = 1;
export const DEFAULT_RUN_MAX_HP = 100;

export type RunStateStatus = "active" | "dead" | "cleared" | "abandoned";

export type RunCharacterState = {
	currentHp: number;
	maxHp: number;
};

export type RunInventoryState = {
	itemInstances: string[];
	relicInstances: string[];
};

export type RunLoadoutState = {
	weaponId: string | null;
	subweaponId: string | null;
	ring1Id: string | null;
	ring2Id: string | null;
};

export type RunBuildState = {
	equippedRelicIds: string[];
};

export type RunMapState = {
	mapId: string;
	seed: number;
	currentNodeId: string;
	currentRound: number;
	choicePath: number[];
	nodeStatuses: Record<string, string>;
};

export type RunState = {
	schemaVersion: number;
	status: RunStateStatus;
	character: RunCharacterState;
	inventory: RunInventoryState;
	loadout: RunLoadoutState;
	build: RunBuildState;
	map: RunMapState;
	acquiredItemValue: number;
	runCurrency: number;
};

export type CreateInitialRunStateInput = Readonly<{
	seed: number;
	mapId?: string;
	maxHp?: number;
	initialHp?: number;
}>;

const validateSeed = (seed: number): number => {
	if (!Number.isSafeInteger(seed) || seed < 0) {
		throw new RangeError("Run seed must be a non-negative safe integer.");
	}

	return seed;
};

const validatePositive = (name: string, value: number): number => {
	if (!Number.isFinite(value) || value <= 0) {
		throw new RangeError(`${name} must be a finite positive number.`);
	}

	return value;
};

const validateNonNegative = (name: string, value: number): number => {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError(`${name} must be a finite non-negative number.`);
	}

	return value;
};

export const createInitialRunState = ({
	seed,
	mapId = "tower-v1",
	maxHp = DEFAULT_RUN_MAX_HP,
	initialHp = maxHp,
}: CreateInitialRunStateInput): RunState => {
	const validatedMaxHp = validatePositive("Maximum HP", maxHp);
	const validatedInitialHp = validateNonNegative("Initial HP", initialHp);

	if (mapId.trim().length === 0) {
		throw new RangeError("Map id must not be empty.");
	}

	return {
		schemaVersion: RUN_STATE_SCHEMA_VERSION,
		status: "active",
		character: {
			currentHp: Math.min(validatedInitialHp, validatedMaxHp),
			maxHp: validatedMaxHp,
		},
		inventory: { itemInstances: [], relicInstances: [] },
		loadout: {
			weaponId: null,
			subweaponId: null,
			ring1Id: null,
			ring2Id: null,
		},
		build: { equippedRelicIds: [] },
		map: {
			mapId,
			seed: validateSeed(seed),
			currentNodeId: "start",
			currentRound: 1,
			choicePath: [],
			nodeStatuses: {},
		},
		acquiredItemValue: 0,
		runCurrency: 0,
	};
};
