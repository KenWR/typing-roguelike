import Phaser from "phaser";
import { createRewardSelectionFixtureAdapter, type RewardSelectionAdapter } from "../rewards/reward-selection-adapter";
import { getRewardSourcePresentation, type RewardSource } from "../rewards/reward-source-presentation";
import type {
  RewardCandidate,
  RewardKind,
  RewardRarity,
  RewardSelectionViewState,
} from "../rewards/reward-selection-view-state";
import type { RingReplacementOption } from "../rewards/reward-selection-adapter";

const COLORS = {
  background: 0x0c1422,
  panel: 0x111d2f,
  panelRaised: 0x17263a,
  border: 0x34465f,
  text: "#edf4fb",
  muted: "#9eb0c4",
  dim: "#6f839a",
  accent: 0x5eead4,
  selected: 0xfcd34d,
  disabled: 0x304054,
} as const;

const RARITY_PRESENTATION: Record<RewardRarity, Readonly<{ label: string; color: string; accent: number }>> = {
  common: { label: "COMMON", color: "#cbd5e1", accent: 0x94a3b8 },
  uncommon: { label: "UNCOMMON", color: "#5eead4", accent: 0x14b8a6 },
  rare: { label: "RARE", color: "#93c5fd", accent: 0x3b82f6 },
  epic: { label: "EPIC", color: "#c4b5fd", accent: 0x8b5cf6 },
  legendary: { label: "LEGENDARY", color: "#fcd34d", accent: 0xf59e0b },
};

const KIND_LABELS: Record<RewardKind, string> = {
  weapon: "무기",
  relic: "유물",
  ring: "반지",
  skill: "스킬",
  currency: "재화",
};

export type RewardSelectionSceneData = Readonly<{
  adapter?: RewardSelectionAdapter<unknown>;
  nextSceneKey?: string;
  rewardSource?: RewardSource;
}>;

type RewardCardView = Readonly<{
  candidate: RewardCandidate;
  container: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Rectangle;
  accentBar: Phaser.GameObjects.Rectangle;
  rarityText: Phaser.GameObjects.Text;
  kindText: Phaser.GameObjects.Text;
  iconText: Phaser.GameObjects.Text;
  iconImage?: Phaser.GameObjects.Image;
  nameText: Phaser.GameObjects.Text;
  descriptionText: Phaser.GameObjects.Text;
  effectText: Phaser.GameObjects.Text;
  actionText: Phaser.GameObjects.Text;
}>;

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(Math.max(value, minimum), maximum);

export class RewardSelectionScene extends Phaser.Scene {
  private adapter: RewardSelectionAdapter<unknown> = createRewardSelectionFixtureAdapter();
  private nextSceneKey: string | undefined;
  private rewardSource: RewardSource = "combat-victory";
  private backdrop!: Phaser.GameObjects.Graphics;
  private headerPanel!: Phaser.GameObjects.Rectangle;
  private headerTitle!: Phaser.GameObjects.Text;
  private headerMeta!: Phaser.GameObjects.Text;
  private currencyText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private selectionText!: Phaser.GameObjects.Text;
  private footerPanel!: Phaser.GameObjects.Rectangle;
  private continueButton!: Phaser.GameObjects.Rectangle;
  private continueText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private rewardTooltip?: Phaser.GameObjects.Container;
  private ringReplacementModal?: Phaser.GameObjects.Container;
  private rewardTooltipCandidateId?: string;
  private cards: RewardCardView[] = [];

  constructor() {
    super("RewardSelectionScene");
  }

  init(data: RewardSelectionSceneData = {}): void {
    this.adapter = data.adapter ?? createRewardSelectionFixtureAdapter();
    this.nextSceneKey = data.nextSceneKey;
    this.rewardSource = data.rewardSource ?? "combat-victory";
  }

  create(): void {
    const state = this.adapter.getViewState();

    this.backdrop = this.add.graphics().setDepth(0);
    this.headerPanel = this.add
      .rectangle(0, 0, 1, 1, COLORS.panel, 0.96)
      .setOrigin(0)
      .setDepth(10)
      .setStrokeStyle(1, COLORS.border, 1);
    this.headerTitle = this.add.text(0, 0, "", this.headerTitleStyle()).setDepth(11);
    this.headerMeta = this.add.text(0, 0, "", this.smallTextStyle()).setDepth(11);
    this.currencyText = this.add.text(0, 0, "", this.currencyTextStyle()).setDepth(11);
    this.instructionText = this.add.text(0, 0, state.subtitle, this.instructionStyle()).setDepth(11);
    this.selectionText = this.add
      .text(0, 0, "보상 후보를 선택하면 상세 효과를 확인할 수 있습니다.", this.smallTextStyle())
      .setDepth(11);

    this.footerPanel = this.add
      .rectangle(0, 0, 1, 1, COLORS.panel, 0.94)
      .setOrigin(0)
      .setDepth(10)
      .setStrokeStyle(1, COLORS.border, 1);
    this.continueButton = this.add.rectangle(0, 0, 1, 1, COLORS.disabled, 1).setOrigin(0).setDepth(11);
    this.continueButton.on(Phaser.Input.Events.POINTER_DOWN, this.handleContinue, this);
    this.continueButton.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (this.adapter.getViewState().status === "selected") {
        this.continueButton.setFillStyle(0xf59e0b, 1);
      }
    });
    this.continueButton.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.refreshContinueButton(this.adapter.getViewState());
    });
    this.continueText = this.add.text(0, 0, "", this.buttonTextStyle()).setOrigin(0.5).setDepth(12);
    this.feedbackText = this.add.text(0, 0, "", this.feedbackTextStyle()).setOrigin(0.5).setDepth(12);

    this.cards = state.candidates.map((candidate) => this.createCard(candidate));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.hideRewardTooltip, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.hideRewardTooltip, this);
    this.applyLayout(this.scale.gameSize.width, this.scale.gameSize.height);
    this.refresh(state);
  }

  private createCard(candidate: RewardCandidate): RewardCardView {
    const container = this.add.container(0, 0).setDepth(20);
    const panel = this.add.rectangle(0, 0, 1, 1, COLORS.panelRaised, 1).setOrigin(0);
    const hitArea = this.add
      .rectangle(0, 0, 1, 1, 0xffffff, 0)
      .setOrigin(0)
      .setDepth(30)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 1, 1), Phaser.Geom.Rectangle.Contains);
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.handleRewardSelection(candidate.id);
    });
    hitArea.on(Phaser.Input.Events.POINTER_OVER, (pointer: Phaser.Input.Pointer) => {
      if (this.adapter.getViewState().status !== "continued") {
        panel.setFillStyle(0x20334b, 1);
        this.showRewardTooltip(candidate, pointer);
      }
    });
    hitArea.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (this.adapter.getViewState().status !== "continued") {
        this.showRewardTooltip(candidate, pointer);
      }
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.refreshCard(candidate.id, this.adapter.getViewState());
      this.hideRewardTooltip();
    });

    const accentBar = this.add.rectangle(0, 0, 4, 1, COLORS.border, 1).setOrigin(0);
    const rarityText = this.add.text(0, 0, "", this.cardMetaStyle());
    const kindText = this.add.text(0, 0, "", this.cardMetaStyle()).setOrigin(1, 0);
    const iconText = this.add.text(0, 0, candidate.icon ?? "◇", this.iconStyle()).setOrigin(0.5);
    const iconImage =
      candidate.imageKey !== undefined && this.textures.exists(candidate.imageKey)
        ? this.add.image(0, 0, candidate.imageKey).setOrigin(0.5)
        : undefined;
    iconText.setVisible(iconImage === undefined);
    const nameText = this.add.text(0, 0, candidate.name, this.cardNameStyle());
    const descriptionText = this.add.text(0, 0, candidate.description, this.cardDescriptionStyle());
    const effectText = this.add.text(0, 0, candidate.effect, this.cardEffectStyle());
    const actionText = this.add.text(0, 0, "선택하기", this.cardActionStyle());
    container.add([
      panel,
      accentBar,
      rarityText,
      kindText,
      ...(iconImage === undefined ? [] : [iconImage]),
      iconText,
      nameText,
      descriptionText,
      effectText,
      actionText,
    ]);
    return {
      candidate,
      container,
      hitArea,
      panel,
      accentBar,
      rarityText,
      kindText,
      iconText,
      iconImage,
      nameText,
      descriptionText,
      effectText,
      actionText,
    };
  }

  protected handleRewardSelection(rewardId: string): void {
    const state = this.adapter.getViewState();
    if (state.status === "continued") {
      return;
    }
    this.refresh(this.adapter.selectReward(rewardId));
  }

  private handleContinue(): void {
    const state = this.adapter.getViewState();
    if (state.status !== "selected") {
      this.feedbackText.setText("먼저 보상 후보 하나를 선택하세요.").setColor("#fbbf24");
      return;
    }

    const replacementOptions = this.adapter.getRingReplacementOptions();
    if (replacementOptions.length > 0) {
      this.showRingReplacementModal(replacementOptions);
      return;
    }

    this.finishContinue();
  }

  private finishContinue(replacementRingId?: string | null): void {
    const continuedState = this.adapter.continue(replacementRingId);
    this.refresh(continuedState);
    if (this.nextSceneKey !== undefined) {
      this.scene.start(this.nextSceneKey, { runState: this.adapter.getRunState() });
    }
  }

  private showRingReplacementModal(options: readonly RingReplacementOption[]): void {
    if (this.ringReplacementModal !== undefined) return;
    const { width, height } = this.scale.gameSize;
    const modal = this.add.container(0, 0).setDepth(1000);
    modal.add(this.add.rectangle(0, 0, width, height, 0x020617, 0.78).setOrigin(0).setInteractive());
    const panelWidth = Math.min(width - 32, 560);
    const panelHeight = 236 + options.length * 52;
    modal.add(
      this.add
        .rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x111d2f, 1)
        .setStrokeStyle(2, COLORS.selected, 1),
    );
    modal.add(
      this.add.text(width / 2, height / 2 - panelHeight / 2 + 28, "반지 교체", this.headerTitleStyle()).setOrigin(0.5),
    );
    modal.add(
      this.add
        .text(
          width / 2,
          height / 2 - panelHeight / 2 + 72,
          "반지는 최대 2개까지 장착할 수 있습니다. 버릴 반지를 선택하세요.",
          this.smallTextStyle(),
        )
        .setOrigin(0.5),
    );
    options.forEach((option, index) => {
      this.addRingReplacementButton(
        modal,
        option.name,
        option.id,
        width / 2,
        height / 2 - panelHeight / 2 + 112 + index * 52,
      );
    });
    this.addRingReplacementButton(
      modal,
      "새 반지 버리기",
      null,
      width / 2,
      height / 2 - panelHeight / 2 + 112 + options.length * 52,
    );
    this.ringReplacementModal = modal;
  }

  private addRingReplacementButton(
    modal: Phaser.GameObjects.Container,
    label: string,
    replacementRingId: string | null,
    x: number,
    y: number,
  ): void {
    const button = this.add
      .text(x, y, replacementRingId === null ? label : `\`${label}\` 버리기`, this.buttonTextStyle())
      .setOrigin(0.5)
      .setPadding(18, 9, 18, 9)
      .setBackgroundColor(replacementRingId === null ? "#334155" : "#7f1d1d")
      .setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.ringReplacementModal?.destroy();
      this.ringReplacementModal = undefined;
      this.finishContinue(replacementRingId);
    });
    modal.add(button);
  }

  private refresh(state: RewardSelectionViewState): void {
    this.hideRewardTooltip();
    const presentation = getRewardSourcePresentation(this.rewardSource, state.title);
    this.headerTitle.setText(presentation.title.toUpperCase());
    this.headerMeta.setText(`ROUND ${String(state.round).padStart(2, "0")}  /  ${presentation.meta}`);
    this.currencyText.setText(`◈  ${state.currency}`);
    this.selectionText.setText(
      state.selectedRewardId === null
        ? "보상 후보를 선택하면 상세 효과를 확인할 수 있습니다."
        : `선택 중  ·  ${this.getCandidate(state.selectedRewardId)?.name ?? "보상"}`,
    );
    this.feedbackText.setText(
      state.status === "continued" ? "RUN STATE  ·  보상이 적용되었습니다. 다음 단계로 이동합니다." : "",
    );
    if (state.status === "continued") {
      this.feedbackText.setColor("#5eead4");
    }
    for (const card of this.cards) {
      this.refreshCard(card.candidate.id, state);
    }
    this.refreshContinueButton(state);
  }

  private refreshCard(rewardId: string, state: RewardSelectionViewState): void {
    const card = this.cards.find((candidateCard) => candidateCard.candidate.id === rewardId);
    if (card === undefined) {
      return;
    }
    const rarity = RARITY_PRESENTATION[card.candidate.rarity];
    const isSelected = state.selectedRewardId === rewardId;
    const isComplete = state.status === "continued";
    const strokeColor = isSelected ? COLORS.selected : rarity.accent;

    card.panel.setStrokeStyle(isSelected ? 3 : 1, strokeColor, isComplete && !isSelected ? 0.45 : 1);
    card.panel.setFillStyle(isSelected ? 0x26364b : COLORS.panelRaised, 1);
    card.accentBar.setFillStyle(strokeColor, isComplete && !isSelected ? 0.45 : 1);
    card.rarityText.setText(rarity.label).setColor(rarity.color);
    card.kindText.setText(KIND_LABELS[card.candidate.kind]);
    card.nameText.setColor(isSelected ? "#fff7cc" : COLORS.text);
    card.effectText.setColor(isSelected ? "#fcd34d" : rarity.color);
    card.actionText
      .setText(isSelected ? (isComplete ? "획득 완료" : "선택됨") : "선택하기")
      .setColor(isSelected ? "#fcd34d" : COLORS.muted);
    card.container.setAlpha(isComplete && !isSelected ? 0.58 : 1);
    card.hitArea.setAlpha(isComplete && !isSelected ? 0.58 : 1);
  }

  private refreshContinueButton(state: RewardSelectionViewState): void {
    const isSelected = state.status === "selected";
    const isComplete = state.status === "continued";
    this.continueButton
      .setFillStyle(isComplete ? 0x164e63 : isSelected ? 0xd97706 : COLORS.disabled, 1)
      .setAlpha(isSelected || isComplete ? 1 : 0.88);
    this.continueText.setText(isComplete ? "다음 단계 준비 완료" : isSelected ? "보상 받기" : "보상 선택");
    this.continueText.setColor(isSelected || isComplete ? "#fff7ed" : COLORS.dim);
    this.continueButton.disableInteractive();
    if (!isComplete) {
      this.continueButton.setInteractive({ useHandCursor: isSelected });
    }
  }

  private applyLayout(width: number, height: number): void {
    const safeInset = clamp(Math.min(width, height) * 0.04, 16, 44);
    const compact = width < 640;
    const headerHeight = compact ? 72 : 78;
    const footerHeight = compact ? 70 : 78;
    const contentWidth = Math.max(0, width - safeInset * 2);
    const headerY = safeInset;
    const introY = headerY + headerHeight + (compact ? 20 : 28);
    const cardsY = introY + (compact ? 58 : 74);
    const footerY = height - safeInset - footerHeight;
    const gap = compact ? 10 : 18;
    const cardsBottom = Math.max(cardsY + 120, footerY - (compact ? 16 : 24));

    this.backdrop.clear();
    this.backdrop.fillGradientStyle(COLORS.background, COLORS.background, 0x162438, 0x0a111d, 1);
    this.backdrop.fillRect(0, 0, width, height);
    this.backdrop.lineStyle(1, 0x2b3c54, 0.22);
    for (let x = -height; x < width + height; x += 72) {
      this.backdrop.lineBetween(x, 0, x + height, height);
    }
    this.backdrop.lineStyle(1, 0x5eead4, 0.06);
    this.backdrop.strokeRect(safeInset, safeInset, contentWidth, height - safeInset * 2);

    this.headerPanel.setPosition(safeInset, headerY).setSize(contentWidth, headerHeight);
    this.headerTitle.setPosition(safeInset + 18, headerY + 13);
    this.headerMeta.setPosition(safeInset + 18, headerY + 43);
    this.currencyText.setPosition(width - safeInset - 18, headerY + headerHeight / 2).setOrigin(1, 0.5);
    this.instructionText.setPosition(safeInset, introY);
    this.selectionText.setPosition(safeInset, introY + (compact ? 30 : 36)).setWordWrapWidth(contentWidth);

    const cardWidth = compact ? contentWidth : Math.max(220, (contentWidth - gap * 2) / 3);
    const cardHeight = compact
      ? clamp((cardsBottom - cardsY - gap * 2) / 3, 132, 176)
      : clamp(cardsBottom - cardsY, 260, 360);

    this.cards.forEach((card, index) => {
      const x = compact ? safeInset : safeInset + index * (cardWidth + gap);
      const y = compact ? cardsY + index * (cardHeight + gap) : cardsY;
      this.layoutCard(card, x, y, cardWidth, cardHeight, compact);
    });

    this.footerPanel.setPosition(safeInset, footerY).setSize(contentWidth, footerHeight);
    const buttonWidth = compact ? contentWidth - 28 : Math.min(280, contentWidth * 0.32);
    const buttonHeight = compact ? 44 : 48;
    this.continueButton.setPosition(width / 2 - buttonWidth / 2, footerY + 14).setSize(buttonWidth, buttonHeight);
    if (this.continueButton.input === null) {
      this.continueButton.setInteractive({ useHandCursor: true });
    } else {
      this.continueButton.input.hitArea.setSize(buttonWidth, buttonHeight);
    }
    this.continueText.setPosition(width / 2, footerY + 14 + buttonHeight / 2);
    this.feedbackText.setPosition(width / 2, footerY + footerHeight - 9);
  }

  private layoutCard(
    card: RewardCardView,
    x: number,
    y: number,
    width: number,
    height: number,
    compact: boolean,
  ): void {
    const padding = compact ? 14 : 20;
    const rarity = RARITY_PRESENTATION[card.candidate.rarity];
    card.container.setPosition(x, y);
    card.container.setSize(width, height);
    card.hitArea.setPosition(x, y).setSize(width, height);
    if (card.hitArea.input !== null) {
      const hitArea = card.hitArea.input.hitArea as Phaser.Geom.Rectangle;
      hitArea.setTo(0, 0, width, height);
    }
    card.panel.setSize(width, height);
    card.accentBar.setPosition(0, 0).setSize(4, height).setFillStyle(rarity.accent, 1);
    card.rarityText.setPosition(padding, padding);
    card.kindText.setPosition(width - padding, padding);
    card.iconText
      .setPosition(compact ? padding + 28 : width / 2, compact ? height / 2 - 6 : height * 0.31)
      .setFontSize(compact ? 26 : 44);
    card.iconImage
      ?.setPosition(compact ? padding + 28 : width / 2, compact ? height / 2 - 6 : height * 0.31)
      .setDisplaySize(compact ? 52 : 92, compact ? 52 : 92);
    card.nameText
      .setPosition(compact ? padding + 68 : padding, compact ? 42 : height * 0.5 - 4)
      .setFontSize(compact ? 20 : 24);
    card.descriptionText
      .setPosition(compact ? padding + 68 : padding, compact ? 72 : height * 0.5 + 38)
      .setWordWrapWidth(compact ? width - padding * 2 - 68 : width - padding * 2)
      .setFontSize(compact ? 13 : 14);
    card.effectText
      .setPosition(padding, compact ? height - 42 : height - 58)
      .setWordWrapWidth(width - padding * 2 - 84)
      .setFontSize(compact ? 13 : 15);
    card.actionText
      .setPosition(width - padding, height - (compact ? 25 : 31))
      .setOrigin(1, 0.5)
      .setFontSize(compact ? 12 : 13);
  }

  private getCandidate(rewardId: string): RewardCandidate | undefined {
    return this.adapter.getViewState().candidates.find((candidate) => candidate.id === rewardId);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.applyLayout(gameSize.width, gameSize.height);
  }

  private releaseResizeListener(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }

  private showRewardTooltip(candidate: RewardCandidate, pointer: Phaser.Input.Pointer): void {
    if (this.rewardTooltip !== undefined && this.rewardTooltipCandidateId === candidate.id) {
      this.positionRewardTooltip(this.rewardTooltip, pointer);
      return;
    }

    this.hideRewardTooltip();

    const tooltipWidth = 360;
    const tooltipHeight = 184;
    const { width, height } = this.scale.gameSize;
    const tooltip = this.add.container(0, 0).setDepth(900);
    tooltip.add(
      this.add
        .rectangle(0, 0, tooltipWidth, tooltipHeight, 0x0f172a, 0.98)
        .setOrigin(0)
        .setStrokeStyle(2, RARITY_PRESENTATION[candidate.rarity].accent),
    );

    if (candidate.imageKey !== undefined && this.textures.exists(candidate.imageKey)) {
      const image = this.add.image(58, 76, candidate.imageKey).setOrigin(0.5);
      const scale = Math.min(82 / image.width, 82 / image.height, 1.4);
      image.setScale(scale);
      tooltip.add(image);
    } else {
      tooltip.add(
        this.add
          .text(58, 76, candidate.icon ?? "◇", this.iconStyle())
          .setOrigin(0.5)
          .setFontSize(36),
      );
    }

    tooltip.add(
      this.add.text(112, 18, candidate.name, {
        ...this.cardNameStyle(),
        fontSize: "18px",
        wordWrap: { width: 228 },
      }),
    );
    tooltip.add(
      this.add.text(
        112,
        48,
        `${KIND_LABELS[candidate.kind]} · ${RARITY_PRESENTATION[candidate.rarity].label}`,
        this.cardMetaStyle(),
      ),
    );
    tooltip.add(
      this.add.text(112, 72, candidate.description, {
        ...this.cardDescriptionStyle(),
        fontSize: "12px",
        wordWrap: { width: 228 },
        lineSpacing: 3,
      }),
    );
    tooltip.add(
      this.add.text(18, 142, candidate.effect, {
        ...this.cardEffectStyle(),
        fontSize: "13px",
        wordWrap: { width: tooltipWidth - 36 },
      }),
    );
    this.rewardTooltip = tooltip;
    this.rewardTooltipCandidateId = candidate.id;
    this.positionRewardTooltip(tooltip, pointer, width, height, tooltipWidth, tooltipHeight);
  }

  private positionRewardTooltip(
    tooltip: Phaser.GameObjects.Container,
    pointer: Phaser.Input.Pointer,
    width = this.scale.gameSize.width,
    height = this.scale.gameSize.height,
    tooltipWidth = 360,
    tooltipHeight = 184,
  ): void {
    tooltip.setPosition(
      Math.min(pointer.x + 18, Math.max(12, width - tooltipWidth - 12)),
      Math.min(pointer.y + 18, Math.max(12, height - tooltipHeight - 12)),
    );
  }

  private hideRewardTooltip(): void {
    this.rewardTooltip?.destroy();
    this.rewardTooltip = undefined;
    this.rewardTooltipCandidateId = undefined;
  }

  private headerTitleStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: COLORS.text,
      fontFamily: "Galmuri9, monospace",
      fontSize: "22px",
      fontStyle: "bold",
    };
  }

  private instructionStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: COLORS.text,
      fontFamily: "Galmuri9, monospace",
      fontSize: "18px",
    };
  }

  private smallTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: COLORS.muted,
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
    };
  }

  private currencyTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: "#fcd34d",
      fontFamily: "Galmuri9, monospace",
      fontSize: "18px",
      fontStyle: "bold",
    };
  }

  private cardMetaStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: COLORS.muted,
      fontFamily: "Galmuri9, monospace",
      fontSize: "12px",
      fontStyle: "bold",
    };
  }

  private iconStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: "#fcd34d",
      fontFamily: "Arial, sans-serif",
      fontSize: "44px",
      fontStyle: "bold",
    };
  }

  private cardNameStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: COLORS.text,
      fontFamily: "Galmuri9, monospace",
      fontSize: "24px",
      fontStyle: "bold",
    };
  }

  private cardDescriptionStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: COLORS.muted,
      fontFamily: "Galmuri9, monospace",
      fontSize: "14px",
      lineSpacing: 5,
    };
  }

  private cardEffectStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: "#93c5fd",
      fontFamily: "Galmuri9, monospace",
      fontSize: "15px",
      fontStyle: "bold",
    };
  }

  private cardActionStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: COLORS.muted,
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
      fontStyle: "bold",
    };
  }

  private buttonTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: COLORS.text,
      fontFamily: "Galmuri9, monospace",
      fontSize: "15px",
      fontStyle: "bold",
    };
  }

  private feedbackTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: "#5eead4",
      fontFamily: "Galmuri9, monospace",
      fontSize: "12px",
    };
  }
}
