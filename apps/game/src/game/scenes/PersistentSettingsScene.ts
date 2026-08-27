import Phaser from "phaser";
import { playRuntimeBgm, setRuntimeAudioSettings } from "../audio/runtime-audio";
import {
  DEFAULT_MENU_SETTINGS,
  applyMenuSettings,
  cycleVolume,
  loadMenuSettings,
  resolveSettingsSnapshotAfterApply,
  saveMenuSettings,
  toggleCommandLanguage,
  toggleScreenShake,
  toggleSound,
  type MenuSettings,
} from "./menu-settings";
import { SCENE_KEYS, resolveSceneTransition } from "./scene-contract";

const FONT_FAMILY = 'Galmuri9, "Apple SD Gothic Neo", monospace';
const PANEL_BACKGROUND = 0x111827;
const FRAME_COLOR = 0x8f7a4f;
const SELECTED_ROW_BACKGROUND = 0x512d70;
const SELECTED_ROW_MARKER = 0xc8a96b;
const SELECTED_TEXT_COLOR = "#fff4d6";
const ROW_TEXT_COLOR = "#d7e2ee";

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

type SettingsButton = {
  container: Phaser.GameObjects.Container;
  hitArea: Phaser.Geom.Rectangle;
  background: Phaser.GameObjects.Rectangle;
  marker: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  value?: Phaser.GameObjects.Text;
};

type SettingsLayout = {
  compact: boolean;
  panelX: number;
  panelTop: number;
  panelWidth: number;
  panelHeight: number;
  panelPadding: number;
  rowWidth: number;
  rowHeight: number;
  rowGap: number;
  actionGap: number;
  rowFontSize: string;
  titleFontSize: string;
  descriptionFontSize: string;
  statusFontSize: string;
  helpFontSize: string;
  titleY: number;
  descriptionY: number;
  firstSettingTop: number;
  statusY: number;
  helpY: number;
};

const resolveSettingsLayout = (width: number, height: number): SettingsLayout => {
  const compact = width < 640 || height < 620;
  const ultraCompact = compact && height <= 420;
  const tightCompact = compact && !ultraCompact && height <= 520;
  const horizontalMargin = compact ? (width <= 320 ? 12 : 16) : 0;
  const panelWidth = Math.max(1, Math.min(compact ? width - horizontalMargin * 2 : 660, width - 24));
  const panelHeight = Math.max(1, Math.min(560, height - (ultraCompact ? 16 : 32)));
  const panelTop = Math.max(ultraCompact ? 8 : 16, (height - panelHeight) / 2);
  const panelX = width / 2;
  const panelPadding = compact ? (ultraCompact ? 12 : tightCompact ? 16 : 24) : 44;
  const rowWidth = Math.max(1, Math.min(compact ? 320 : 460, panelWidth - panelPadding * 2));
  const rowHeight = compact ? (ultraCompact ? 28 : tightCompact ? 34 : 44) : 48;
  const rowGap = compact ? (ultraCompact ? 2 : tightCompact ? 4 : 8) : 10;
  const actionGap = compact ? (ultraCompact ? 6 : tightCompact ? 10 : 20) : 24;
  const titleOffset = compact ? (ultraCompact ? 16 : tightCompact ? 22 : 36) : 44;
  const descriptionOffset = compact ? (ultraCompact ? 40 : tightCompact ? 54 : 73) : 86;
  const firstSettingOffset = compact ? (ultraCompact ? 62 : tightCompact ? 78 : 102) : 112;
  const statusGap = compact ? (ultraCompact ? 18 : tightCompact ? 22 : 32) : 30;
  const footerInset = compact ? (ultraCompact ? 14 : tightCompact ? 22 : 36) : 30;

  const settingsBottom = panelTop + firstSettingOffset + 4 * rowHeight + 3 * rowGap;
  const actionBottom = settingsBottom + actionGap + 2 * rowHeight + rowGap;

  return {
    compact,
    panelX,
    panelTop,
    panelWidth,
    panelHeight,
    panelPadding,
    rowWidth,
    rowHeight,
    rowGap,
    actionGap,
    rowFontSize: compact ? (ultraCompact ? "11px" : tightCompact ? "13px" : "16px") : "20px",
    titleFontSize: compact ? (ultraCompact ? "20px" : tightCompact ? "24px" : "32px") : "40px",
    descriptionFontSize: compact ? (ultraCompact ? "9px" : tightCompact ? "10px" : "12px") : "14px",
    statusFontSize: compact ? (ultraCompact ? "8px" : tightCompact ? "9px" : "12px") : "14px",
    helpFontSize: compact ? (ultraCompact ? "8px" : tightCompact ? "9px" : "11px") : "13px",
    titleY: panelTop + titleOffset,
    descriptionY: panelTop + descriptionOffset,
    firstSettingTop: panelTop + firstSettingOffset,
    statusY: actionBottom + statusGap,
    helpY: panelTop + panelHeight - footerInset,
  };
};

const resolveSettingsStorage = (): SettingsStorage | undefined => {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

const createButton = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  onClick: () => void,
  fontSize: string,
  splitLabel: boolean,
): SettingsButton => {
  const container = scene.add.container(x, y).setSize(width, height);
  const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
  const background = scene.add
    .rectangle(0, 0, width, height, SELECTED_ROW_BACKGROUND, 0.96)
    .setOrigin(0.5)
    .setStrokeStyle(2, FRAME_COLOR, 0.95)
    .setVisible(false);
  const marker = scene.add
    .rectangle(-width / 2 + 3, 0, 3, Math.max(12, height - 14), SELECTED_ROW_MARKER, 1)
    .setOrigin(0.5)
    .setVisible(false);
  const textInset = splitLabel ? Math.max(10, Math.floor(height * 0.4)) : 0;
  const label = scene.add
    .text(splitLabel ? -width / 2 + textInset : 0, 0, "", {
      fontFamily: FONT_FAMILY,
      fontSize,
      color: ROW_TEXT_COLOR,
      align: "center",
    })
    .setOrigin(splitLabel ? 0 : 0.5, 0.5);
  const value = splitLabel
    ? scene.add
        .text(width / 2 - textInset, 0, "", {
          fontFamily: FONT_FAMILY,
          fontSize,
          color: ROW_TEXT_COLOR,
          align: "right",
        })
        .setOrigin(1, 0.5)
    : undefined;

  container.add(background);
  container.add(marker);
  container.add(label);
  if (value !== undefined) container.add(value);
  container
    .setInteractive({
      hitArea,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    })
    .on("pointerdown", onClick);

  return { container, hitArea, background, marker, label, value };
};

export class SettingsScene extends Phaser.Scene {
  private draftSettings: MenuSettings = DEFAULT_MENU_SETTINGS;
  private persistedSettings: MenuSettings = DEFAULT_MENU_SETTINGS;
  private settingsStorage?: SettingsStorage;
  private menuButtons: SettingsButton[] = [];
  private menuActions: Array<() => void> = [];
  private statusLabel?: Phaser.GameObjects.Text;
  private viewportBackground?: Phaser.GameObjects.Rectangle;
  private panelBackground?: Phaser.GameObjects.Rectangle;
  private titleLabel?: Phaser.GameObjects.Text;
  private descriptionLabel?: Phaser.GameObjects.Text;
  private helpLabel?: Phaser.GameObjects.Text;
  private statusMessage = "";
  private statusIsError = false;
  private selectedIndex = 0;
  private keyboardHandler?: (event: KeyboardEvent) => void;
  private resizeHandler?: () => void;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  create(): void {
    this.removeResizeHandler();
    this.removeKeyboardHandler();
    const layout = resolveSettingsLayout(this.scale.gameSize.width, this.scale.gameSize.height);
    const storage = resolveSettingsStorage();

    this.settingsStorage = storage;
    this.statusMessage = "";
    this.statusIsError = false;
    this.selectedIndex = 0;
    this.persistedSettings = loadMenuSettings(storage);
    this.draftSettings = this.persistedSettings;
    playRuntimeBgm("menu");
    const initialApplySucceeded = this.applySettings(this.draftSettings);
    if (!initialApplySucceeded) {
      this.setStatus("현재 세션에 설정을 적용하지 못했습니다.", true);
    }

    this.viewportBackground = this.add
      .rectangle(0, 0, this.scale.gameSize.width, this.scale.gameSize.height, 0x0b1220)
      .setOrigin(0);
    this.panelBackground = this.add
      .rectangle(
        layout.panelX,
        layout.panelTop + layout.panelHeight / 2,
        layout.panelWidth,
        layout.panelHeight,
        PANEL_BACKGROUND,
        0.98,
      )
      .setStrokeStyle(2, FRAME_COLOR, 0.65);
    this.titleLabel = this.add
      .text(layout.panelX, layout.titleY, "설정", {
        fontFamily: FONT_FAMILY,
        fontSize: layout.titleFontSize,
        color: SELECTED_TEXT_COLOR,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.descriptionLabel = this.add
      .text(layout.panelX, layout.descriptionY, "변경 사항은 즉시 미리 적용됩니다", {
        fontFamily: FONT_FAMILY,
        fontSize: layout.descriptionFontSize,
        color: "#b8c6d9",
      })
      .setOrigin(0.5);

    const actions: Array<() => void> = [
      () => this.updateDraft(toggleSound(this.draftSettings)),
      () => this.updateDraft(cycleVolume(this.draftSettings)),
      () => this.updateDraft(toggleScreenShake(this.draftSettings)),
      () => this.updateDraft(toggleCommandLanguage(this.draftSettings)),
      () => this.applyDraftSettings(),
      () => this.leaveSettings(),
    ];
    this.menuActions = actions;
    this.menuButtons = actions.map((_, index) => {
      const button = createButton(
        this,
        layout.panelX,
        this.resolveButtonY(layout, index),
        layout.rowWidth,
        layout.rowHeight,
        () => {
          this.selectedIndex = index;
          this.refresh();
          this.menuActions[index]?.();
        },
        layout.rowFontSize,
        index < 4,
      );
      button.container.on("pointerover", () => {
        this.selectedIndex = index;
        this.refresh();
      });
      return button;
    });

    this.statusLabel = this.add
      .text(layout.panelX, layout.statusY, "", {
        fontFamily: FONT_FAMILY,
        fontSize: layout.statusFontSize,
        color: "#a7f3d0",
        align: "center",
        lineSpacing: 4,
        wordWrap: { width: Math.max(1, layout.panelWidth - layout.panelPadding * 2) },
      })
      .setOrigin(0.5);
    this.helpLabel = this.add
      .text(layout.panelX, layout.helpY, "↑ ↓ 선택   Enter / Space 실행   Esc 뒤로", {
        fontFamily: FONT_FAMILY,
        fontSize: layout.helpFontSize,
        color: "#94a3b8",
      })
      .setOrigin(0.5);

    this.renderLayout();
    this.resizeHandler = (): void => this.renderLayout();
    this.scale.on("resize", this.resizeHandler);
    this.installKeyboardHandler();
  }

  shutdown(): void {
    this.removeResizeHandler();
    this.removeKeyboardHandler();
    this.menuButtons = [];
    this.menuActions = [];
    this.statusLabel = undefined;
    this.viewportBackground = undefined;
    this.panelBackground = undefined;
    this.titleLabel = undefined;
    this.descriptionLabel = undefined;
    this.helpLabel = undefined;
  }

  private installKeyboardHandler(): void {
    this.removeKeyboardHandler();
    this.keyboardHandler = (event: KeyboardEvent): void => {
      if (this.menuButtons.length === 0) return;

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? -1 : 1;
        this.selectedIndex = (this.selectedIndex + direction + this.menuButtons.length) % this.menuButtons.length;
        this.refresh();
        return;
      }

      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar" || event.code === "Space") {
        event.preventDefault();
        this.menuActions[this.selectedIndex]?.();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        this.leaveSettings();
      }
    };
    this.input.keyboard?.on("keydown", this.keyboardHandler);
  }

  private removeKeyboardHandler(): void {
    if (this.keyboardHandler === undefined) return;
    this.input.keyboard?.off("keydown", this.keyboardHandler);
    this.keyboardHandler = undefined;
  }

  private removeResizeHandler(): void {
    if (this.resizeHandler === undefined) return;
    this.scale.off("resize", this.resizeHandler);
    this.resizeHandler = undefined;
  }

  private resolveButtonY(layout: SettingsLayout, index: number): number {
    if (index < 4) {
      return layout.firstSettingTop + layout.rowHeight / 2 + index * (layout.rowHeight + layout.rowGap);
    }

    const settingsBottom = layout.firstSettingTop + 4 * layout.rowHeight + 3 * layout.rowGap;
    return settingsBottom + layout.actionGap + layout.rowHeight / 2 + (index - 4) * (layout.rowHeight + layout.rowGap);
  }

  private renderLayout(): void {
    const { width, height } = this.scale.gameSize;
    const layout = resolveSettingsLayout(width, height);
    const contentWidth = Math.max(1, layout.panelWidth - layout.panelPadding * 2);

    this.viewportBackground?.setSize(width, height);
    this.panelBackground
      ?.setPosition(layout.panelX, layout.panelTop + layout.panelHeight / 2)
      .setSize(layout.panelWidth, layout.panelHeight);
    this.titleLabel?.setPosition(layout.panelX, layout.titleY).setFontSize(layout.titleFontSize);
    this.descriptionLabel?.setPosition(layout.panelX, layout.descriptionY).setFontSize(layout.descriptionFontSize);

    this.menuButtons.forEach((button, index) => {
      const splitLabel = button.value !== undefined;
      const textInset = splitLabel ? Math.max(10, Math.floor(layout.rowHeight * 0.4)) : 0;
      const buttonY = this.resolveButtonY(layout, index);
      button.container.setPosition(layout.panelX, buttonY).setSize(layout.rowWidth, layout.rowHeight);
      button.hitArea.setTo(-layout.rowWidth / 2, -layout.rowHeight / 2, layout.rowWidth, layout.rowHeight);
      button.background.setPosition(0, 0).setSize(layout.rowWidth, layout.rowHeight);
      button.marker.setPosition(-layout.rowWidth / 2 + 3, 0).setSize(3, Math.max(8, layout.rowHeight - 12));
      button.label.setPosition(splitLabel ? -layout.rowWidth / 2 + textInset : 0, 0).setFontSize(layout.rowFontSize);
      button.value?.setPosition(layout.rowWidth / 2 - textInset, 0).setFontSize(layout.rowFontSize);
    });

    this.statusLabel
      ?.setPosition(layout.panelX, layout.statusY)
      .setFontSize(layout.statusFontSize)
      .setWordWrapWidth(contentWidth)
      .setLineSpacing(layout.compact && layout.rowHeight <= 34 ? 1 : 4);
    this.helpLabel?.setPosition(layout.panelX, layout.helpY).setFontSize(layout.helpFontSize);
    this.refresh();
  }

  private updateDraft(nextSettings: MenuSettings): void {
    this.draftSettings = nextSettings;
    if (!this.applySettings(this.draftSettings)) {
      this.setStatus("변경한 설정을 현재 세션에 적용하지 못했습니다.", true);
    } else {
      this.clearStatus();
    }
    this.refresh();
  }

  private applyDraftSettings(): void {
    const saved = saveMenuSettings(this.draftSettings, this.settingsStorage);
    const applied = this.applySettings(this.draftSettings);
    this.persistedSettings = resolveSettingsSnapshotAfterApply(this.persistedSettings, this.draftSettings, applied);

    if (!saved) {
      this.setStatus("저장하지 못했습니다. 현재 세션에는 적용되지만 다시 실행하면 복원되지 않습니다.", true);
    } else if (!applied) {
      this.setStatus("설정을 저장했지만 현재 세션에 적용하지 못했습니다.", true);
    } else {
      this.setStatus("설정을 저장했습니다.", false);
    }
    this.refresh();
  }

  private applySettings(settings: MenuSettings): boolean {
    try {
      const applied = applyMenuSettings(this, settings);
      setRuntimeAudioSettings({
        muted: !settings.soundEnabled,
        volume: settings.volume,
      });
      return applied;
    } catch {
      return false;
    }
  }

  private leaveSettings(): void {
    this.draftSettings = this.persistedSettings;
    this.applySettings(this.persistedSettings);
    this.removeKeyboardHandler();
    const transition = resolveSceneTransition(SCENE_KEYS.start, undefined);
    this.scene.start(transition.key, transition.payload);
  }

  private setStatus(message: string, isError: boolean): void {
    this.statusMessage = message;
    this.statusIsError = isError;
  }

  private clearStatus(): void {
    this.statusMessage = "";
    this.statusIsError = false;
  }

  private refresh(): void {
    const labels = [
      `효과음: ${this.draftSettings.soundEnabled ? "켜짐" : "꺼짐"}`,
      `음량: ${Math.round(this.draftSettings.volume * 100)}%`,
      `화면 흔들림: ${this.draftSettings.screenShakeEnabled ? "켜짐" : "꺼짐"}`,
      `커맨드 표시 언어: ${this.draftSettings.commandLanguage === "ko" ? "한국어" : "English"}`,
      "적용",
      "뒤로",
    ];

    const settingRows: Array<[string, string]> = [
      ["효과음", this.draftSettings.soundEnabled ? "켜짐" : "꺼짐"],
      ["음량", `${Math.round(this.draftSettings.volume * 100)}%`],
      ["화면 흔들림", this.draftSettings.screenShakeEnabled ? "켜짐" : "꺼짐"],
      ["커맨드 표시 언어", this.draftSettings.commandLanguage === "ko" ? "한국어" : "English"],
    ];

    this.menuButtons.forEach((button, index) => {
      const selected = index === this.selectedIndex;
      const textColor = selected ? SELECTED_TEXT_COLOR : ROW_TEXT_COLOR;
      if (index < settingRows.length) {
        const [label, value] = settingRows[index];
        button.label.setText(label);
        button.value?.setText(value);
      } else {
        button.label.setText(labels[index] ?? "");
      }
      button.background.setVisible(selected);
      button.marker.setVisible(selected);
      button.label.setColor(textColor).setFontStyle(selected ? "bold" : "normal");
      button.value?.setColor(textColor).setFontStyle(selected ? "bold" : "normal");
    });
    this.statusLabel?.setText(this.statusMessage).setColor(this.statusIsError ? "#fca5a5" : "#a7f3d0");
  }
}
