import type { RunState } from "@typing-roguelike/shared";
import { createRunRewardSelectionFlow } from "./run-reward-selection";
import type { RewardSelectionAdapter } from "./reward-selection-adapter";

export type RunRewardSceneEntry = Readonly<{
  adapter: RewardSelectionAdapter<RunState>;
  nextSceneKey: string;
}>;

export const createRunRewardSceneEntry = (
  runState: RunState,
): RunRewardSceneEntry => {
  const flow = createRunRewardSelectionFlow({ runState });
  return {
    adapter: flow.adapter,
    nextSceneKey: flow.nextSceneKey,
  };
};
