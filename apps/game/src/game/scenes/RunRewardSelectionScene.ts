import Phaser from "phaser";
import type { RunState } from "@typing-roguelike/shared";
import type { RewardSelectionAdapter } from "../rewards/reward-selection-adapter";
import { createRunRewardSceneEntry } from "../rewards/run-reward-scene-entry";
import { runSession } from "../run/run-session";
import {
  RewardSelectionScene,
  type RewardSelectionSceneData,
} from "./RewardSelectionScene";

export type RunRewardSelectionSceneData = RewardSelectionSceneData &
  Readonly<{
    runState?: RunState;
    nodeId?: string;
    nextNodeIds?: readonly string[];
    suppressPointerUntilRelease?: boolean;
  }>;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const persistedAdapters = new WeakMap<object, RewardSelectionAdapter<unknown>>();

const withRunPersistence = (
  adapter: RewardSelectionAdapter<unknown>,
): RewardSelectionAdapter<unknown> => {
  const cached = persistedAdapters.get(adapter as object);
  if (cached !== undefined) return cached;

  const wrapped: RewardSelectionAdapter<unknown> = {
    getViewState: adapter.getViewState,
    getRunState: adapter.getRunState,
    selectReward: adapter.selectReward,
    continue: () => {
      const state = adapter.continue();
      const completedRun = adapter.getRunState() as RunState;
      if (runSession.get()?.status === "active") {
        runSession.update(() => completedRun);
      }
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
  private cardHitAreas: Phaser.GameObjects.Rectangle[] = [];
  private pointerSelectionBlocked = false;

  override init(data: RunRewardSelectionSceneData = {}): void {
    this.routeData = data;
    this.cardHitAreas = [];
    this.pointerSelectionBlocked = data.suppressPointerUntilRelease === true;

    if (data.adapter !== undefined) {
      const adapter = data.runState === undefined
        ? data.adapter
        : withRunPersistence(data.adapter);
      this.runAdapter = data.runState === undefined
        ? undefined
        : adapter as RewardSelectionAdapter<RunState>;
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
      onContinue: (completedRun) => {
        if (runSession.get()?.status === "active") {
          runSession.update(() => completedRun);
        }
      },
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

    this.installCardInputLayer();
    if (this.pointerSelectionBlocked) {
      this.input.once(Phaser.Input.Events.POINTER_UP, this.releaseTransitionPointer, this);
    }
    this.routeData = { ...this.routeData, suppressPointerUntilRelease: false };
    this.input.keyboard?.on("keydown", this.handleRewardKeyDown, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutCardHitAreas, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseRunInput, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseRunInput, this);
  }

  private installCardInputLayer(): void {
    const candidates = this.runAdapter?.getViewState().candidates ?? [];
    this.cardHitAreas = candidates.map((candidate) => {
      const hitArea = this.add
        .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
        .setOrigin(0)
        .setDepth(80)
        .setInteractive({ useHandCursor: true });
      hitArea.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (this.pointerSelectionBlocked) return;
        this.selectReward(candidate.id);
      });
      return hitArea;
    });
    this.layoutCardHitAreas();
  }

  private releaseTransitionPointer(): void {
    this.pointerSelectionBlocked = false;
  }

  private layoutCardHitAreas(): void {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const safeInset = clamp(Math.min(width, height) * 0.04, 16, 44);
    const compact = width < 640;
    const headerHeight = compact ? 72 : 78;
    const footerHeight = compact ? 70 : 78;
    const contentWidth = Math.max(0, width - safeInset * 2);
    const introY = safeInset + headerHeight + (compact ? 20 : 28);
    const cardsY = introY + (compact ? 58 : 74);
    const footerY = height - safeInset - footerHeight;
    const gap = compact ? 10 : 18;
    const cardsBottom = Math.max(cardsY + 120, footerY - (compact ? 16 : 24));
    const cardWidth = compact
      ? contentWidth
      : Math.max(220, (contentWidth - gap * 2) / 3);
    const cardHeight = compact
      ? clamp((cardsBottom - cardsY - gap * 2) / 3, 132, 176)
      : clamp(cardsBottom - cardsY, 260, 360);

    this.cardHitAreas.forEach((hitArea, index) => {
      const x = compact ? safeInset : safeInset + index * (cardWidth + gap);
      const y = compact ? cardsY + index * (cardHeight + gap) : cardsY;
      hitArea.setPosition(x, y).setSize(cardWidth, cardHeight);
      if (hitArea.input !== null) hitArea.input.hitArea.setSize(cardWidth, cardHeight);
    });
  }

  private handleRewardKeyDown(event: KeyboardEvent): void {
    const adapter = this.runAdapter;
    if (adapter === undefined || adapter.getViewState().status === "continued") return;

    const candidates = adapter.getViewState().candidates;
    if (candidates.length === 0) return;

    const digit = Number.parseInt(event.key, 10);
    if (Number.isInteger(digit) && digit >= 1 && digit <= candidates.length) {
      event.preventDefault();
      this.selectReward(candidates[digit - 1]!.id);
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Enter") return;
    event.preventDefault();
    const selectedId = adapter.getViewState().selectedRewardId;
    const currentIndex = Math.max(0, candidates.findIndex((candidate) => candidate.id === selectedId));
    const nextIndex = event.key === "ArrowLeft"
      ? (currentIndex - 1 + candidates.length) % candidates.length
      : event.key === "ArrowRight"
        ? (currentIndex + 1) % candidates.length
        : currentIndex;
    this.selectReward(candidates[nextIndex]!.id);
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
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutCardHitAreas, this);
  }
}
