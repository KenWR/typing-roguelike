import { describe, expect, test } from "bun:test";
import {
  createRewardSelectionAdapter,
  type RewardSelectionRunState,
} from "../src/game/rewards/reward-selection-adapter";
import {
  continueRewardSelection,
  createRewardSelectionViewState,
  selectReward,
  type RewardCandidate,
} from "../src/game/rewards/reward-selection-view-state";

const candidates: readonly RewardCandidate[] = [
  {
    id: "rusty-sword",
    kind: "weapon",
    name: "녹슨 검",
    rarity: "common",
    description: "기본 공격이 안정적으로 이어집니다.",
    effect: "공격력 +8",
  },
  {
    id: "ember-charm",
    kind: "relic",
    name: "잿불 부적",
    rarity: "rare",
    description: "연속 입력이 불씨를 남깁니다.",
    effect: "콤보 보너스 +12%",
  },
  {
    id: "focus-rune",
    kind: "skill",
    name: "집중의 룬",
    rarity: "uncommon",
    description: "다음 커맨드의 시간을 확보합니다.",
    effect: "AP 회복 +6",
  },
];

const createViewState = () =>
  createRewardSelectionViewState({
    candidates,
    round: 3,
    currency: 120,
  });

describe("reward selection view state", () => {
  test("exposes every reward candidate before a choice", () => {
    const state = createViewState();

    expect(state).toMatchObject({
      round: 3,
      currency: 120,
      selectedRewardId: null,
      status: "pending",
    });
    expect(state.candidates).toEqual(candidates);
  });

  test("stores the selected candidate and only continues after a choice", () => {
    const selected = selectReward(createViewState(), "ember-charm");

    expect(selected).toMatchObject({
      selectedRewardId: "ember-charm",
      status: "selected",
    });
    expect(continueRewardSelection(selected)).toMatchObject({
      selectedRewardId: "ember-charm",
      status: "continued",
    });
    expect(() => continueRewardSelection(createViewState())).toThrow(
      "Select a reward before continuing.",
    );
    expect(() => selectReward(createViewState(), "unknown-reward")).toThrow(
      "Reward candidate not found: unknown-reward",
    );
  });
});

describe("reward selection adapter", () => {
  test("applies the selected reward to run state and advances the next step", () => {
    const initialRunState: RewardSelectionRunState = {
      inventory: [],
      selectedRewardIds: [],
      nextStep: null,
    };
    let continuedRunState: RewardSelectionRunState | null = null;

    const adapter = createRewardSelectionAdapter({
      initialViewState: createViewState(),
      initialRunState,
      applySelection: (runState, reward) => ({
        ...runState,
        inventory: [...runState.inventory, reward.id],
        selectedRewardIds: [...runState.selectedRewardIds, reward.id],
      }),
      onContinue: (runState) => {
        continuedRunState = { ...runState, nextStep: "map" };
      },
    });

    adapter.selectReward("ember-charm");
    expect(adapter.getRunState()).toEqual(initialRunState);

    expect(adapter.continue()).toMatchObject({
      selectedRewardId: "ember-charm",
      status: "continued",
    });
    expect(adapter.getRunState()).toMatchObject({
      inventory: ["ember-charm"],
      selectedRewardIds: ["ember-charm"],
    });
    expect(continuedRunState).toMatchObject({
      inventory: ["ember-charm"],
      nextStep: "map",
    });
  });
});
