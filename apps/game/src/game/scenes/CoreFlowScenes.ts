import Phaser from "phaser";
import type { RunState } from "@typing-roguelike/shared";
import { playRuntimeBgm, setRuntimeAudioSettings } from "../audio/runtime-audio";
import { TEXTURE_KEYS } from "../assets/asset-catalog";
import { createMapHudView } from "../run/map-hud-view";
import { runRemotePersistence } from "../run/run-remote-persistence";
import { runSession } from "../run/run-session";
import { LobbyRunStarter } from "./lobby-run-start";
import {
  DEFAULT_MENU_SETTINGS,
  loadMenuSettings,
  saveMenuSettings,
  toggleSound,
  type MenuSettings,
} from "./menu-settings";
import { SCENE_KEYS, resolveSceneTransition, type SceneKey } from "./scene-contract";

abstract class EmptyCoreScene extends Phaser.Scene {
  protected constructor(key: SceneKey) {
    super(key);
  }
}

const createMenuButton = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Text => {
  const button = scene.add
    .text(x, y, label, {
      fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
      fontSize: "30px",
      color: "#f9fafb",
      backgroundColor: "#1f2937",
      padding: { x: 24, y: 14 },
      align: "center",
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  button.on("pointerover", () => button.setStyle({ backgroundColor: "#374151" }));
  button.on("pointerout", () => button.setStyle({ backgroundColor: "#1f2937" }));
  button.on("pointerdown", onClick);
  return button;
};

const createCoverBackground = (
  scene: Phaser.Scene,
  textureKey: string,
  width: number,
  height: number,
): Phaser.GameObjects.Image => {
  const image = scene.add.image(width / 2, height / 2, textureKey);
  return image.setScale(Math.max(width / image.width, height / image.height));
};

export class StartScene extends EmptyCoreScene {
  private readonly runStarter = new LobbyRunStarter();
  private helpModal?: Phaser.GameObjects.Container;
  private helpKeyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super(SCENE_KEYS.start);
  }

  create(): void {
    playRuntimeBgm("menu");
    const { width, height } = this.scale.gameSize;
    createCoverBackground(this, TEXTURE_KEYS.mainBackground, width, height);
    this.add.rectangle(0, 0, width, height, 0x08101b, 0.28).setOrigin(0);
    const compact = height < 540;
    const startButtonY = compact ? height * 0.5 : height * 0.52;
    const startRunButton = createMenuButton(this, width / 2, startButtonY, "게임 시작", async () => {
      startRunButton.disableInteractive();
      startRunButton.setText("게임 시작 중...");
      startRunButton.setStyle({ backgroundColor: "#4b5563" });
      try {
        const runState = await this.runStarter.startPersisted();
        if (runState === null) return;
        const transition = resolveSceneTransition(SCENE_KEYS.map, { runState });
        this.scene.start(transition.key, transition.payload);
      } catch {
        startRunButton.setText("게임 시작 · 다시 시도");
        startRunButton.setStyle({ backgroundColor: "#1f2937" });
        startRunButton.setInteractive({ useHandCursor: true });
      }
    });
    createMenuButton(this, width / 2, compact ? height * 0.68 : height * 0.66, "플레이 방법", () =>
      this.showHelpModal(),
    );
    createMenuButton(this, width / 2, compact ? height * 0.86 : height * 0.8, "설정", () => {
      const transition = resolveSceneTransition(SCENE_KEYS.settings, undefined);
      this.scene.start(transition.key, transition.payload);
    });

    const logo = this.add.image(width / 2, 0, TEXTURE_KEYS.brandLogo);
    const logoAspect = logo.height / logo.width;
    const desiredLogoWidth = Math.min(Phaser.Math.Clamp(width * 0.42, 300, 580), Math.max(1, width - 32));
    const logoTopMargin = height < 540 ? 14 : 20;
    const logoButtonGap = height < 540 ? 16 : 24;
    const startButtonTop = startRunButton.getBounds().top;
    const maxLogoHeight = Math.max(1, startButtonTop - logoTopMargin - logoButtonGap);
    const logoHeight = Math.min(desiredLogoWidth * logoAspect, maxLogoHeight);
    const logoWidth = logoHeight / logoAspect;
    const maxLogoTop = Math.max(logoTopMargin, startButtonTop - logoButtonGap - logoHeight);
    const preferredLogoTop = height * 0.24 - logoHeight / 2;
    const logoTop = Phaser.Math.Clamp(preferredLogoTop, logoTopMargin, maxLogoTop);
    logo.setPosition(width / 2, logoTop + logoHeight / 2).setDisplaySize(logoWidth, logoHeight);
  }

  shutdown(): void {
    if (this.helpKeyHandler !== undefined) {
      this.input.keyboard?.off("keydown", this.helpKeyHandler);
      this.helpKeyHandler = undefined;
    }
    this.helpModal?.destroy();
    this.helpModal = undefined;
  }

  private showHelpModal(): void {
    if (this.helpModal !== undefined) return;

    const { width, height } = this.scale.gameSize;
    const fontFamily = 'Galmuri9, "Apple SD Gothic Neo", monospace';
    const panelWidth = Math.min(720, Math.max(300, width - 40));
    const maxPanelHeight = width < 520 ? 680 : 570;
    const minimumPanelHeight = width < 520 ? 560 : 420;
    const panelHeight = Math.min(maxPanelHeight, Math.max(minimumPanelHeight, height - 32));
    const panelX = width / 2;
    const panelY = height / 2;
    const contentWidth = panelWidth - 56;
    const modal = this.add.container(0, 0).setDepth(100);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x020617, 0.76).setOrigin(0).setInteractive();
    backdrop.on("pointerdown", (pointer: Phaser.Input.Pointer) => pointer.event.stopPropagation());
    modal.add(backdrop);

    const panel = this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x111827, 0.98)
      .setStrokeStyle(2, 0x4fd1c5, 0.85)
      .setInteractive();
    panel.on("pointerdown", (pointer: Phaser.Input.Pointer) => pointer.event.stopPropagation());
    modal.add(panel);

    modal.add(
      this.add
        .text(panelX, panelY - panelHeight / 2 + 38, "플레이 방법", {
          fontFamily,
          fontSize: "30px",
          fontStyle: "bold",
          color: "#f9fafb",
        })
        .setOrigin(0.5),
    );

    const instructions = [
      "1. 맵에서 갈 수 있는 노드를 클릭해 다음 장소로 이동합니다.",
      "2. 전투에서는 기술 목록의 커맨드를 그대로 입력한 뒤 Enter를 누릅니다.",
      "   예시: 베기 입력 → Enter  (기본 기술 · 베기)",
      "   예시: 이중 베기 입력 → Enter  (특수 기술 · 이중 베기)",
      "3. Tab으로 공격할 적을 바꿀 수 있습니다. Shift + Tab은 이전 대상입니다.",
      "4. 커맨드를 성공시키면 콤보가 쌓이고, 틀린 커맨드를 Enter로 제출하면 콤보가 초기화됩니다.",
      "5. 전투가 끝나면 보상을 하나 선택하고, 다시 맵에서 다음 노드를 선택합니다.",
    ].join("\n");

    modal.add(
      this.add
        .text(panelX - contentWidth / 2, panelY - panelHeight / 2 + 88, instructions, {
          fontFamily,
          fontSize: width < 520 ? "14px" : "17px",
          color: "#d7e2ee",
          lineSpacing: width < 520 ? 5 : 10,
          wordWrap: { width: contentWidth },
        })
        .setOrigin(0, 0),
    );

    const closeButton = createMenuButton(this, panelX, panelY + panelHeight / 2 - 48, "닫기", () =>
      this.hideHelpModal(),
    );
    closeButton.setStyle({ fontSize: width < 520 ? "22px" : "26px" });
    modal.add(closeButton);
    this.helpModal = modal;

    this.helpKeyHandler = (event: KeyboardEvent): void => {
      if (event.key === "Escape") this.hideHelpModal();
    };
    this.input.keyboard?.on("keydown", this.helpKeyHandler);
  }

  private hideHelpModal(): void {
    if (this.helpKeyHandler !== undefined) {
      this.input.keyboard?.off("keydown", this.helpKeyHandler);
      this.helpKeyHandler = undefined;
    }
    this.helpModal?.destroy();
    this.helpModal = undefined;
  }
}

export class SettingsScene extends EmptyCoreScene {
  private draftSettings: MenuSettings = DEFAULT_MENU_SETTINGS;
  private soundLabel?: Phaser.GameObjects.Text;
  constructor() {
    super(SCENE_KEYS.settings);
  }
  create(): void {
    playRuntimeBgm("menu");
    const { width, height } = this.scale.gameSize;
    const storage = typeof localStorage === "undefined" ? undefined : localStorage;
    this.draftSettings = loadMenuSettings(storage);
    this.add.rectangle(0, 0, width, height, 0x111827).setOrigin(0);
    this.add
      .text(width / 2, height * 0.24, "설정", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "44px",
        color: "#f9fafb",
      })
      .setOrigin(0.5);
    this.soundLabel = createMenuButton(this, width / 2, height * 0.46, "", () => {
      this.draftSettings = toggleSound(this.draftSettings);
      this.refreshSoundLabel();
    });
    this.refreshSoundLabel();
    createMenuButton(this, width / 2, height * 0.62, "적용", () => {
      saveMenuSettings(this.draftSettings, storage);
      this.sound.mute = !this.draftSettings.soundEnabled;
      setRuntimeAudioSettings({ muted: !this.draftSettings.soundEnabled, volume: this.draftSettings.volume });
    });
    createMenuButton(this, width / 2, height * 0.76, "뒤로", () => {
      const transition = resolveSceneTransition(SCENE_KEYS.start, undefined);
      this.scene.start(transition.key, transition.payload);
    });
  }
  private refreshSoundLabel(): void {
    this.soundLabel?.setText(`효과음: ${this.draftSettings.soundEnabled ? "켜짐" : "꺼짐"}`);
  }
}

export class MapScene extends EmptyCoreScene {
  protected readonly renderLegacyMapChoices: boolean = true;
  private runState?: Readonly<RunState>;
  constructor() {
    super(SCENE_KEYS.map);
  }
  init(data: { runState?: Readonly<RunState> }): void {
    this.runState = data.runState;
  }
  create(): void {
    playRuntimeBgm("tower");
    const { width, height } = this.scale.gameSize;
    const activeRun = this.runState ?? runSession.get();
    createCoverBackground(this, TEXTURE_KEYS.mapBackground, width, height);
    if (activeRun === null || activeRun === undefined) {
      this.add
        .text(width / 2, height / 2, "런 상태를 찾을 수 없습니다.", {
          fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
          fontSize: "28px",
          color: "#fca5a5",
        })
        .setOrigin(0.5);
      return;
    }
    const view = createMapHudView(activeRun);
    const fontFamily = 'Galmuri9, "Apple SD Gothic Neo", monospace';
    const syncStatus = runRemotePersistence.syncStatus;
    const hudSideMargin = width < 960 ? 16 : 28;
    const hudPanelWidth = Phaser.Math.Clamp(Math.floor((width - 360) / 2), 220, 300);
    const leftHudX = hudSideMargin;
    this.add
      .text(width / 2, 42, `MAP · ${view.floor}F`, {
        fontFamily,
        fontSize: "36px",
        fontStyle: "bold",
        color: "#f9fafb",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 78, syncStatus.message, {
        fontFamily,
        fontSize: "14px",
        fontStyle: "bold",
        color: syncStatus.mode === "local_fallback" ? "#fbbf24" : "#9ca3af",
      })
      .setOrigin(0.5);
    this.add.text(leftHudX + 22, 110, "RUN HUD", { fontFamily, fontSize: "22px", fontStyle: "bold", color: "#45d78c" });
    this.add.text(leftHudX + 22, 150, `HP  ${view.hpText}`, {
      fontFamily,
      fontSize: "20px",
      fontStyle: "bold",
      color: "#45d78c",
    });
    this.add.text(leftHudX + 22, 184, `골드  ${view.currencyText}`, {
      fontFamily,
      fontSize: "20px",
      fontStyle: "bold",
      color: "#45d78c",
    });
    this.add.text(leftHudX + 22, 218, `장비  ${view.equipmentText}`, {
      fontFamily,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#45d78c",
      wordWrap: { width: hudPanelWidth - 50 },
    });
    this.add
      .text(width / 2, 118, `현재 위치 · ${view.currentLocation}`, {
        fontFamily,
        fontSize: "22px",
        fontStyle: "bold",
        color: "#45d78c",
        align: "center",
        wordWrap: { width: Math.max(260, width - leftHudX - hudPanelWidth - 24) },
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 172, `경로  ${view.pathText}`, {
        fontFamily,
        fontSize: "18px",
        fontStyle: "bold",
        color: "#9ca3af",
        align: "45d78c",
        wordWrap: { width: Math.max(260, width - leftHudX - hudPanelWidth - 24) },
      })
      .setOrigin(0.5);
    if (!this.renderLegacyMapChoices) return;
    const nodeXs = [width / 2 - 240, width / 2, width / 2 + 240];
    view.nodes.forEach((node, index) => {
      const x = nodeXs[index] ?? width / 2;
      this.add
        .rectangle(
          x,
          500,
          190,
          116,
          node.status === "available" ? 0x2563eb : node.status === "cleared" ? 0x15803d : 0x374151,
        )
        .setOrigin(0.5);
      this.add.text(x, 500, node.type.toUpperCase(), { fontFamily, fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);
    });
  }
}

export class ShopScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.shop);
  }
}
export class RestScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.rest);
  }
}
