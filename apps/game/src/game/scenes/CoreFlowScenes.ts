import Phaser from "phaser";
import type { MapNodeStatus, RunState } from "@typing-roguelike/shared";
import { playRuntimeBgm, setRuntimeAudioMuted } from "../audio/runtime-audio";
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

export class StartScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.start);
  }

  create(): void {
    playRuntimeBgm("menu");
    const { width, height } = this.scale.gameSize;
    this.add.rectangle(0, 0, width, height, 0x111827).setOrigin(0);
    this.add
      .text(width / 2, height * 0.28, "TYPING ROGUELIKE", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "48px",
        color: "#f9fafb",
      })
      .setOrigin(0.5);

    createMenuButton(this, width / 2, height * 0.52, "게임 시작", () => {
      const transition = resolveSceneTransition(SCENE_KEYS.lobby, undefined);
      this.scene.start(transition.key, transition.payload);
    });

    createMenuButton(this, width / 2, height * 0.66, "설정", () => {
      const transition = resolveSceneTransition(SCENE_KEYS.settings, undefined);
      this.scene.start(transition.key, transition.payload);
    });
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
      setRuntimeAudioMuted(!this.draftSettings.soundEnabled);
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

export class LobbyScene extends EmptyCoreScene {
  private readonly runStarter = new LobbyRunStarter();

  constructor() {
    super(SCENE_KEYS.lobby);
  }

  create(): void {
    playRuntimeBgm("tower");
    const { width, height } = this.scale.gameSize;
    this.add.rectangle(0, 0, width, height, 0x111827).setOrigin(0);
    this.add
      .text(width / 2, height * 0.3, "로비", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "48px",
        color: "#f9fafb",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.43, "새 런을 시작할 수 있습니다.", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "24px",
        color: "#9ca3af",
      })
      .setOrigin(0.5);

    const startRunButton = createMenuButton(
      this,
      width / 2,
      height * 0.62,
      "새 런 시작",
      async () => {
        startRunButton.disableInteractive();
        startRunButton.setText("런 시작 중...");
        startRunButton.setStyle({ backgroundColor: "#4b5563" });

        try {
          const runState = await this.runStarter.startPersisted();
          if (runState === null) return;

          const transition = resolveSceneTransition(SCENE_KEYS.map, { runState });
          this.scene.start(transition.key, transition.payload);
        } catch {
          startRunButton.setText("새 런 시작 · 다시 시도");
          startRunButton.setStyle({ backgroundColor: "#1f2937" });
          startRunButton.setInteractive({ useHandCursor: true });
        }
      },
    );
  }
}

const NODE_STYLE: Record<MapNodeStatus, { fill: number; label: string }> = {
  locked: { fill: 0x374151, label: "LOCKED" },
  available: { fill: 0x2563eb, label: "AVAILABLE" },
  in_progress: { fill: 0xd97706, label: "IN PROGRESS" },
  cleared: { fill: 0x15803d, label: "CLEARED" },
};

export class MapScene extends EmptyCoreScene {
  protected readonly renderLegacyMapChoices = true;
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
    this.add.rectangle(0, 0, width, height, 0x111827).setOrigin(0);

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
    const rightHudX = width - hudSideMargin - hudPanelWidth;
    const centerHudWidth = Math.max(260, rightHudX - (leftHudX + hudPanelWidth) - 24);

    this.add
      .text(width / 2, 42, `MAP · ${view.floor}F`, {
        fontFamily,
        fontSize: "36px",
        color: "#f9fafb",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 78, syncStatus.message, {
        fontFamily,
        fontSize: "14px",
        color: syncStatus.mode === "local_fallback" ? "#fbbf24" : "#9ca3af",
      })
      .setOrigin(0.5);

    this.add.rectangle(leftHudX, 92, hudPanelWidth, 190, 0x1f2937).setOrigin(0);
    this.add.text(leftHudX + 22, 110, "RUN HUD", { fontFamily, fontSize: "22px", color: "#f9fafb" });
    this.add.text(leftHudX + 22, 150, `HP  ${view.hpText}`, { fontFamily, fontSize: "20px", color: "#f9fafb" });
    this.add.text(leftHudX + 22, 184, `재화  ${view.currencyText}`, { fontFamily, fontSize: "20px", color: "#f9fafb" });
    this.add.text(leftHudX + 22, 218, `장비  ${view.equipmentText}`, {
      fontFamily,
      fontSize: "18px",
      color: "#d1d5db",
      wordWrap: { width: hudPanelWidth - 50 },
    });

    this.add.rectangle(rightHudX, 92, hudPanelWidth, 190, 0x1f2937).setOrigin(0);
    this.add.text(rightHudX + 22, 110, "NODE STATUS", {
      fontFamily,
      fontSize: "22px",
      color: "#f9fafb",
    });
    (Object.keys(NODE_STYLE) as MapNodeStatus[]).forEach((status, index) => {
      const style = NODE_STYLE[status];
      const y = 150 + index * 30;
      this.add.rectangle(rightHudX + 32, y + 9, 18, 18, style.fill).setOrigin(0.5);
      this.add.text(rightHudX + 56, y, style.label, {
        fontFamily,
        fontSize: "16px",
        color: "#d1d5db",
      });
    });

    this.add
      .text(width / 2, 118, `현재 위치 · ${view.currentLocation}`, {
        fontFamily,
        fontSize: "22px",
        color: "#f9fafb",
        align: "center",
        wordWrap: { width: centerHudWidth },
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 172, `경로  ${view.pathText}`, {
        fontFamily,
        fontSize: "18px",
        color: "#9ca3af",
        align: "center",
        wordWrap: { width: centerHudWidth },
      })
      .setOrigin(0.5);

    if (!this.renderLegacyMapChoices) return;

    this.add.line(width / 2, 0, 0, 320, 0, 390, 0x6b7280).setOrigin(0.5, 0);
    const nodeXs = [width / 2 - 240, width / 2, width / 2 + 240];
    view.nodes.forEach((node, index) => {
      const x = nodeXs[index] ?? width / 2;
      const style = NODE_STYLE[node.status];
      this.add.line(0, 0, width / 2, 390, x, 450, 0x4b5563).setOrigin(0);
      this.add.rectangle(x, 500, 190, 116, style.fill).setOrigin(0.5);
      this.add
        .text(x, 474, node.type.toUpperCase(), {
          fontFamily,
          fontSize: "22px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      this.add
        .text(x, 512, style.label, {
          fontFamily,
          fontSize: "15px",
          color: "#e5e7eb",
        })
        .setOrigin(0.5);
      this.add
        .text(x, 540, node.id, {
          fontFamily,
          fontSize: "14px",
          color: "#d1d5db",
        })
        .setOrigin(0.5);
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
