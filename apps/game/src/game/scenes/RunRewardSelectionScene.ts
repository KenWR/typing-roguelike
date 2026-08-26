import Phaser from "phaser";
import type { RunState } from "@typing-roguelike/shared";
import type { RewardSelectionAdapter } from "../rewards/reward-selection-adapter";
import { createRunRewardSceneEntry } from "../rewards/run-reward-scene-entry";
import {
  createRewardTransitionPointerGuard,
  type RewardTransitionPointerGuard,
} from "../rewards/reward-transition-pointer-guard";
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

  const persistRun = (): void => {
    const completedRun = adapter.getRunState() as RunState;
    if (runSession.get()?.status === "active") {
      runSession.update(() => completedRun);
    }
  };

  const wrapped: RewardSelectionAdapter<unknown> = {
    getViewState: adapter.getViewState,
    getRunState: adapter.getRunState,
    selectReward: adapter.selectReward,
    continue: () => {
      const state = adapter.continue();
      persistRun();
      return state;
    },
    skip: () => {
      const state = adapter.skip();
      persistRun();
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
  private skipButton?: Phaser.GameObjects.Rectangle;
  private skipText?: Phaser.GameObjects.Text;
  private transitionPointerGuard: RewardTransitionPointerGuard =
    createRewardTransitionPointerGuard();

  override init(data: RunRewardSelectionSceneData = {}): void {
    this.routeData = data;
    this.cardHitAreas = [];
    this.skipButton = undefined;
    this.skipText = undefined;
    this.transitionPointerGuard = createRewardTransitionPointerGuard(
      data.suppressPointerUntilRelease === true,
    );

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
    this.installSkipControl();
    if (!this.transitionPointerGuard.acceptsPointerDown()) {
      this.input.once(Phaser.Input.Events.POINTER_UP, this.releaseTransitionPointer, this);
    }
    this.routeData = { ...this.routeData, suppressPointerUntilRelease: false };
    this.input.keyboard?.on("keydown", this.handleRewardKeyDown, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutRunControls, this);
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
        if (!this.transitionPointerGuard.acceptsPointerDown()) return;
        this.selectReward(candidate.id);
      });
      return hitArea;
    });
    this.layoutCardHitAreas();
  }

  private installSkipControl(): void {
    this.skipButton = this.add
      .rectangle(0, 0, 1, 1, 0x1f2937, 1)
      .setOrigin(0)
      .setDepth(82)
      .setStrokeStyle(1, 0x64748b, 1)
      .setInteractive({ useHandCursor: true });
    this.skipButton.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!this.transitionPointerGuard.acceptsPointerDown()) return;
      this.skipReward();
    });
    this.skipButton.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.skipButton?.setFillStyle(0x334155, 1);
    });
    this.skipButton.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.skipButton?.setFillStyle(0x1f2937, 1);
    });
    this.skipText = this.add
      .text(0, 0, "선택하지 않기", {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5)
      .setDepth(83);
    this.layoutSkipControl();
  }

  private releaseTransitionPointer(): void {
    this.transitionPointerGuard.release();
  }

  private layoutRunControls(): void {
    this.layoutCardHitAreas();
    this.layoutSkipControl();
  }

  private layoutSkipControl(): void {
    if (this.skipButton === undefined || this.skipText === undefined) return;

    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const safeInset = clamp(Math.min(width, height) * 0.04, 16, 44);
    const compact = width < 640;
    const footerHeight = compact ? 70 : 78;
    const footerY = height - safeInset - footerHeight;
    const buttonWidth = compact ? 136 : 164;
    const buttonHeight = compact ? 36 : 40;
    const x = safeInset + 16;
    const y = footerY + (footerHeight - buttonHeight) / 2;

    this.skipButton.setPosition(x, y).setSize(buttonWidth, buttonHeight);
    if (this.skipButton.input !== null) {
      this.skipButton.input.hitArea.setSize(buttonWidth, buttonHeight);
    }
    this.skipText.setPosition(x + buttonWidth / 2, y + buttonHeight / 2);
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

    if (event.key === "Escape") {
      event.preventDefault();
      this.skipReward();
      return;
    }

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

  private skipReward(): void {
    const adapter = this.runAdapter;
    if (adapter === undefined || adapter.getViewState().status === "continued") return;

    adapter.skip();
    if (this.routeData.nextSceneKey !== undefined) {
      this.scene.start(this.routeData.nextSceneKey, { runState: adapter.getRunState() });
    }
  }

  private releaseRunInput(): void {
    this.input.off(Phaser.Input.Events.POINTER_UP, this.releaseTransitionPointer, this);
    this.input.keyboard?.off("keydown", this.handleRewardKeyDown, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutRunControls, this);
  }
}
