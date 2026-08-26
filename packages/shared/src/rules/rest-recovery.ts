import type { RunState } from "../contracts/backend/run-state.ts";

export type RestRecoveryConfig = Readonly<{
	healAmount: number;
}>;

export type ApplyRestRecoveryInput = Readonly<{
	resultId: string;
	runState: RunState;
	config: RestRecoveryConfig;
	appliedResultIds?: ReadonlySet<string>;
}>;

export type RestRecoveryResult = Readonly<{
	applied: boolean;
	resultId: string;
	beforeHp: number;
	afterHp: number;
	healedAmount: number;
	runState: RunState;
	appliedResultIds: ReadonlySet<string>;
}>;

const validateResultId = (resultId: string): string => {
	const normalized = resultId.trim();
	if (normalized.length === 0) {
		throw new RangeError("Rest result id must not be empty.");
	}
	return normalized;
};

const validateHealAmount = (healAmount: number): number => {
	if (!Number.isFinite(healAmount) || healAmount < 0) {
		throw new RangeError("Rest heal amount must be a finite non-negative number.");
	}
	return healAmount;
};

const validateCharacterHp = (runState: RunState): void => {
	const { currentHp, maxHp } = runState.character;
	if (!Number.isFinite(maxHp) || maxHp <= 0) {
		throw new RangeError("Run maximum HP must be a finite positive number.");
	}
	if (!Number.isFinite(currentHp) || currentHp < 0 || currentHp > maxHp) {
		throw new RangeError("Run current HP must be between zero and maximum HP.");
	}
};

export const applyRestRecovery = ({
	resultId,
	runState,
	config,
	appliedResultIds = new Set<string>(),
}: ApplyRestRecoveryInput): RestRecoveryResult => {
	const normalizedResultId = validateResultId(resultId);
	const healAmount = validateHealAmount(config.healAmount);
	validateCharacterHp(runState);

	if (runState.status !== "active") {
		throw new Error("Rest recovery can only be applied to an active run.");
	}

	const beforeHp = runState.character.currentHp;
	if (appliedResultIds.has(normalizedResultId)) {
		return {
			applied: false,
			resultId: normalizedResultId,
			beforeHp,
			afterHp: beforeHp,
			healedAmount: 0,
			runState,
			appliedResultIds,
		};
	}

	const afterHp = Math.min(runState.character.maxHp, beforeHp + healAmount);
	const nextAppliedResultIds = new Set(appliedResultIds);
	nextAppliedResultIds.add(normalizedResultId);
	return {
		applied: true,
		resultId: normalizedResultId,
		beforeHp,
		afterHp,
		healedAmount: afterHp - beforeHp,
		runState: {
			...runState,
			character: {
				...runState.character,
				currentHp: afterHp,
			},
		},
		appliedResultIds: nextAppliedResultIds,
	};
};
