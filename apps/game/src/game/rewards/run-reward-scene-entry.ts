import type { RunState } from "@typing-roguelike/shared";
import { createRunRewardSelectionFlow } from "./run-reward-selection";
import type { RewardSelectionAdapter } from "./reward-selection-adapter";

export type RunRewardSceneEntry = Readonly<{
  adapter: RewardSelectionAdapter<RunState>;
  nextSceneKey: string;
}>;

export type CreateRunRewardSceneEntryOptions = Readonly<{
  runState: RunState;
  nodeId?: string;
  nextNodeIds?: readonly string[];
  onContinue?: (runState: RunState) => void;
}>;

export const createRunRewardSceneEntry = ({
  runState,
  nodeId,
  nextNodeIds,
  onContinue,
}: CreateRunRewardSceneEntryOptions): RunRewardSceneEntry => {
  const flow = createRunRewardSelectionFlow({ runState, nodeId, nextNodeIds, onContinue });
  return {
    adapter: flow.adapter,
    nextSceneKey: flow.nextSceneKey,
  };
};
