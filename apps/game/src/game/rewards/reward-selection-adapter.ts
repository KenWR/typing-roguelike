import { playRewardPickupSound } from "../audio/runtime-audio";
import { getRelicIconTextureKey } from "../assets/asset-catalog";
import {
  continueRewardSelection,
  createRewardSelectionViewState,
  selectReward,
  type RewardCandidate,
  type RewardSelectionViewState,
} from "./reward-selection-view-state";

export type RewardSelectionRunState = Readonly<{
  inventory: readonly string[];
  selectedRewardIds: readonly string[];
  nextStep: string | null;
}>;

export type RingReplacementOption = Readonly<{
  id: string;
  name: string;
}>;

export type RewardSelectionAdapter<TRunState = RewardSelectionRunState> = Readonly<{
  getViewState: () => RewardSelectionViewState;
  getRunState: () => TRunState;
  selectReward: (rewardId: string) => RewardSelectionViewState;
  continue: (replacementRingId?: string | null) => RewardSelectionViewState;
  getRingReplacementOptions: () => readonly RingReplacementOption[];
}>;

export type CreateRewardSelectionAdapterOptions<TRunState> = Readonly<{
  initialViewState: RewardSelectionViewState;
  initialRunState: TRunState;
  applySelection: (runState: TRunState, reward: RewardCandidate, replacementRingId?: string | null) => TRunState;
  getRingReplacementOptions?: (runState: TRunState, reward: RewardCandidate) => readonly RingReplacementOption[];
  onContinue?: (runState: TRunState, reward: RewardCandidate) => void;
}>;

/** Equipment, relic, and ring rewards all use the relic pickup cue. */
export const usesRewardPickupSound = (kind: RewardCandidate["kind"]): boolean =>
  kind === "weapon" || kind === "relic" || kind === "ring";

export function createRewardSelectionAdapter<TRunState>(
  options: CreateRewardSelectionAdapterOptions<TRunState>,
): RewardSelectionAdapter<TRunState> {
  let viewState = options.initialViewState;
  let runState = options.initialRunState;

  const getSelectedReward = (): RewardCandidate => {
    const selectedRewardId = viewState.selectedRewardId;
    if (selectedRewardId === null) throw new Error("Select a reward before continuing.");
    const reward = viewState.candidates.find((candidate) => candidate.id === selectedRewardId);
    if (reward === undefined) throw new Error(`Reward candidate not found: ${selectedRewardId}`);
    return reward;
  };

  return {
    getViewState: () => viewState,
    getRunState: () => runState,
    getRingReplacementOptions: () => {
      const selectedReward =
        viewState.selectedRewardId === null
          ? undefined
          : viewState.candidates.find((candidate) => candidate.id === viewState.selectedRewardId);
      return selectedReward === undefined || options.getRingReplacementOptions === undefined
        ? []
        : options.getRingReplacementOptions(runState, selectedReward);
    },
    selectReward: (rewardId) => {
      const previousRewardId = viewState.selectedRewardId;
      viewState = selectReward(viewState, rewardId);
      const selectedReward = viewState.candidates.find((candidate) => candidate.id === rewardId);
      if (
        viewState.selectedRewardId === rewardId &&
        previousRewardId !== rewardId &&
        selectedReward !== undefined &&
        usesRewardPickupSound(selectedReward.kind)
      ) {
        playRewardPickupSound();
      }
      return viewState;
    },
    continue: (replacementRingId) => {
      const reward = getSelectedReward();
      const replacementOptions = options.getRingReplacementOptions?.(runState, reward) ?? [];
      if (replacementOptions.length > 0 && replacementRingId === undefined) {
        throw new Error("Choose a ring to discard before continuing.");
      }
      viewState = continueRewardSelection(viewState);
      runState = options.applySelection(runState, reward, replacementRingId);
      options.onContinue?.(runState, reward);
      return viewState;
    },
  };
}

export const REWARD_SELECTION_FIXTURE_CANDIDATES: readonly RewardCandidate[] = [
  {
    id: "ember-blade",
    kind: "weapon",
    name: "잿불 칼날",
    rarity: "rare",
    description: "불씨를 품은 칼날이 다음 공격을 가볍게 만듭니다.",
    effect: "공격력 +14 · 화상 확률 +8%",
    icon: "✦",
  },
  {
    id: "relic_echo_charm",
    kind: "relic",
    name: "메아리의 부적",
    rarity: "rare",
    description: "기술 성공 시 일정 확률로 AP를 회복합니다.",
    effect: "AP +1 · 전투당 최대 2회",
    icon: "◈",
    imageKey: getRelicIconTextureKey("relic_echo_charm"),
  },
  {
    id: "quiet-focus",
    kind: "skill",
    name: "고요한 집중",
    rarity: "epic",
    description: "호흡을 고르고 다음 커맨드에 시간을 더합니다.",
    effect: "AP 회복 +6 · 입력 시간 +1초",
    icon: "◎",
  },
];

export function createRewardSelectionFixtureAdapter(): RewardSelectionAdapter {
  const initialRunState: RewardSelectionRunState = { inventory: [], selectedRewardIds: [], nextStep: null };
  return createRewardSelectionAdapter<RewardSelectionRunState>({
    initialViewState: createRewardSelectionViewState({
      candidates: REWARD_SELECTION_FIXTURE_CANDIDATES,
      round: 3,
      currency: 120,
    }),
    initialRunState,
    applySelection: (runState, reward) => ({
      ...runState,
      inventory: [...runState.inventory, reward.id],
      selectedRewardIds: [...runState.selectedRewardIds, reward.id],
    }),
  });
}
