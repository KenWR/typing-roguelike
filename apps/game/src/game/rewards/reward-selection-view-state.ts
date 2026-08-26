export type RewardKind = "weapon" | "relic" | "skill" | "currency";

export type RewardRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type RewardCandidate = Readonly<{
  id: string;
  kind: RewardKind;
  name: string;
  rarity: RewardRarity;
  description: string;
  effect: string;
  icon?: string;
  value?: number;
}>;

export type RewardSelectionStatus = "pending" | "selected" | "continued";

export type RewardSelectionViewState = Readonly<{
  title: string;
  subtitle: string;
  round: number;
  currency: number;
  candidates: readonly RewardCandidate[];
  selectedRewardId: string | null;
  status: RewardSelectionStatus;
}>;

export type RewardSelectionViewStateInput = Readonly<{
  candidates: readonly RewardCandidate[];
  round: number;
  currency: number;
  title?: string;
  subtitle?: string;
}>;

const DEFAULT_TITLE = "전투 보상";
const DEFAULT_SUBTITLE = "보상 후보를 비교하고 하나를 선택하세요.";

const assertNonBlank = (value: string, label: string): void => {
  if (value.trim().length === 0) {
    throw new RangeError(`${label} must not be blank.`);
  }
};

const validateCandidate = (candidate: RewardCandidate): void => {
  assertNonBlank(candidate.id, "Reward id");
  assertNonBlank(candidate.name, "Reward name");
  assertNonBlank(candidate.description, "Reward description");
  assertNonBlank(candidate.effect, "Reward effect");

  if (candidate.value !== undefined && (!Number.isFinite(candidate.value) || candidate.value < 0)) {
    throw new RangeError("Reward value must be a finite non-negative number.");
  }
};

export function createRewardSelectionViewState(
  input: RewardSelectionViewStateInput,
): RewardSelectionViewState {
  if (!Number.isInteger(input.round) || input.round < 1) {
    throw new RangeError("Reward round must be a positive integer.");
  }
  if (!Number.isFinite(input.currency) || input.currency < 0) {
    throw new RangeError("Reward currency must be a finite non-negative number.");
  }
  if (input.candidates.length === 0) {
    throw new RangeError("At least one reward candidate is required.");
  }

  const candidateIds = new Set<string>();
  for (const candidate of input.candidates) {
    validateCandidate(candidate);
    if (candidateIds.has(candidate.id)) {
      throw new RangeError(`Reward candidate id is duplicated: ${candidate.id}`);
    }
    candidateIds.add(candidate.id);
  }

  return {
    title: input.title ?? DEFAULT_TITLE,
    subtitle: input.subtitle ?? DEFAULT_SUBTITLE,
    round: input.round,
    currency: input.currency,
    candidates: [...input.candidates],
    selectedRewardId: null,
    status: "pending",
  };
}

export function selectReward(
  state: RewardSelectionViewState,
  rewardId: string,
): RewardSelectionViewState {
  if (state.status === "continued") {
    throw new Error("Reward selection is already complete.");
  }
  if (!state.candidates.some((candidate) => candidate.id === rewardId)) {
    throw new Error(`Reward candidate not found: ${rewardId}`);
  }

  return {
    ...state,
    selectedRewardId: rewardId,
    status: "selected",
  };
}

export function continueRewardSelection(
  state: RewardSelectionViewState,
): RewardSelectionViewState {
  if (state.status === "continued") {
    throw new Error("Reward selection is already complete.");
  }
  if (state.selectedRewardId === null) {
    throw new Error("Select a reward before continuing.");
  }

  return {
    ...state,
    status: "continued",
  };
}
