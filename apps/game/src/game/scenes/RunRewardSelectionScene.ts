import type { RunState } from "@typing-roguelike/shared";
import type { RewardSelectionAdapter } from "../rewards/reward-selection-adapter";
import { createRunRewardSceneEntry } from "../rewards/run-reward-scene-entry";
import {
  RewardSelectionScene,
  type RewardSelectionSceneData,
} from "./RewardSelectionScene";

export type RunRewardSelectionSceneData = RewardSelectionSceneData &
  Readonly<{
    runState?: RunState;
  }>;

export class RunRewardSelectionScene extends RewardSelectionScene {
  override init(data: RunRewardSelectionSceneData = {}): void {
    if (data.adapter !== undefined) {
      super.init(data);
      return;
    }

    if (data.runState === undefined) {
      super.init(data);
      return;
    }

    const entry = createRunRewardSceneEntry(data.runState);
    super.init({
      adapter: entry.adapter as RewardSelectionAdapter<unknown>,
      nextSceneKey: data.nextSceneKey ?? entry.nextSceneKey,
    });
  }
}
