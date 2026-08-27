import Phaser from "phaser";
import type { RunState } from "@typing-roguelike/shared";
import type { RewardSelectionAdapter } from "../rewards/reward-selection-adapter";
import { persistCompletedRunReward } from "../rewards/run-reward-persistence";
import { createRunRewardSceneEntry } from "../rewards/run-reward-scene-entry";
import {
  createRewardTransitionPointerGuard,
  type RewardTransitionPointerGuard,
} from "../rewards/reward-transition-pointer-guard";
import { RewardSelectionScene, type RewardSelectionSceneData } from "./RewardSelectionScene";

export type RunRewardSelectionSceneData = RewardSelectionSceneData &
  Readonly<{
    runState?: RunState;
    nodeId?: string;
    nextNodeIds?: readonly string[];
    suppressPointerUntilRelease?: boolean;
  }>;

const persistedAdapters = new WeakMap<object, RewardSelectionAdapter<unknown>>();

const withRunPersistence = (adapter: RewardSelectionAdapter<unknown>): RewardSelectionAdapter<unknown> => {
  const cached = persistedAdapters.get(adapter as object);
  if (cached !== undefined) return cached;

  const wrapped: RewardSelectionAdapter<unknown> = {
    getViewState: adapter.getViewState,
    getRunState: adapter.getRunState,
    getRingReplacementOptions: adapter.getRingReplacementOptions,
    selectReward: adapter.selectReward,
    continue: (replacementRingId) => {
      const state = adapter.continue(replacementRingId);
      const completedRun = adapter.getRunState() as RunState;
      persistCompletedRunReward(completedRun);
      return state;
    },
  };
  persistedAdapters.set(adapter as object, wrapped);
  persistedAdapters.set(wrapped as object, wrapped);
  return wrapped;
};

export class RunRewardSelectionScene extends RewardSelectionScene {
  private runAdapter?: RewardSelectionAdapter<RunState>;
  private routeData: RunRewardSelectionSceneData = {};
  private transitionPointerGuard: RewardTransitionPointerGuard = createRewardTransitionPointerGuard();

  override init(data: RunRewardSelectionSceneData = {}): void {
    this.routeData = data;
    this.transitionPointerGuard = createRewardTransitionPointerGuard(data.suppressPointerUntilRelease === true);

    if (data.adapter !== undefined) {
      const adapter = data.runState === undefined ? data.adapter : withRunPersistence(data.adapter);
      this.runAdapter = data.runState === undefined ? undefined : (adapter as RewardSelectionAdapter<RunState>);
      this.routeData = { ...data, adapter };
      super.init(this.routeData);
      return;
    }

    if (data.runState === undefined) {
      this.runAdapter = undefined;
      super.init(data);
      return;
    }

    const entry = createRunRewardSceneEntry({
      runState: data.runState,
      nodeId: data.nodeId,
      nextNodeIds: data.nextNodeIds,
      onContinue: persistCompletedRunReward,
    });
    this.runAdapter = entry.adapter;
    this.routeData = {
      ...data,
      nextSceneKey: data.nextSceneKey ?? entry.nextSceneKey,
    };
    super.init({
      adapter: entry.adapter as RewardSelectionAdapter<unknown>,
      nextSceneKey: this.routeData.nextSceneKey,
    });
  }

  override create(): void {
    super.create();
    if (this.runAdapter === undefined) return;

    if (!this.transitionPointerGuard.acceptsPointerDown()) {
      this.input.once(Phaser.Input.Events.POINTER_UP, this.releaseTransitionPointer, this);
    }
    this.routeData = { ...this.routeData, suppressPointerUntilRelease: false };
    this.input.keyboard?.on("keydown", this.handleRewardKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseRunInput, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseRunInput, this);
  }

  private releaseTransitionPointer(): void {
    this.transitionPointerGuard.release();
  }

  protected override handleRewardSelection(rewardId: string): void {
    if (this.runAdapter === undefined) {
      super.handleRewardSelection(rewardId);
      return;
    }
    if (!this.transitionPointerGuard.acceptsPointerDown()) return;
    this.selectReward(rewardId);
  }

  private handleRewardKeyDown(event: KeyboardEvent): void {
    const adapter = this.runAdapter;
    if (adapter === undefined || adapter.getViewState().status === "continued") return;

    const candidates = adapter.getViewState().candidates;
    if (candidates.length === 0) return;

    const digit = Number.parseInt(event.key, 10);
    if (Number.isInteger(digit) && digit >= 1 && digit <= candidates.length) {
      event.preventDefault();
      const candidate = candidates[digit - 1];
      if (candidate !== undefined) this.selectReward(candidate.id);
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Enter") return;
    event.preventDefault();
    const selectedId = adapter.getViewState().selectedRewardId;
    const currentIndex = Math.max(
      0,
      candidates.findIndex((candidate) => candidate.id === selectedId),
    );
    const nextIndex =
      event.key === "ArrowLeft"
        ? (currentIndex - 1 + candidates.length) % candidates.length
        : event.key === "ArrowRight"
          ? (currentIndex + 1) % candidates.length
          : currentIndex;
    const candidate = candidates[nextIndex];
    if (candidate !== undefined) this.selectReward(candidate.id);
  }

  private selectReward(rewardId: string): void {
    const adapter = this.runAdapter;
    if (adapter === undefined || adapter.getViewState().status === "continued") return;

    adapter.selectReward(rewardId);
    this.scene.restart({
      ...this.routeData,
      adapter: adapter as RewardSelectionAdapter<unknown>,
    });
  }

  private releaseRunInput(): void {
    this.input.off(Phaser.Input.Events.POINTER_UP, this.releaseTransitionPointer, this);
    this.input.keyboard?.off("keydown", this.handleRewardKeyDown, this);
  }
}
