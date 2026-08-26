import Phaser from "phaser";
import type { RunState } from "@typing-roguelike/shared";
import { playRuntimeBgm, setRuntimeAudioSettings } from "../audio/runtime-audio";
import { TEXTURE_KEYS } from "../assets/asset-catalog";
import { createMapHudView } from "../run/map-hud-view";
import { runRemotePersistence } from "../run/run-remote-persistence";
import { runSession } from "../run/run-session";
import { LobbyRunStarter } from "./lobby-run-start";
import { DEFAULT_MENU_SETTINGS, loadMenuSettings, saveMenuSettings, toggleSound, type MenuSettings } from "./menu-settings";
import { SCENE_KEYS, resolveSceneTransition, type SceneKey } from "./scene-contract";

abstract class EmptyCoreScene extends Phaser.Scene { protected constructor(key: SceneKey) { super(key); } }

const createMenuButton = (scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text => {
  const button = scene.add.text(x, y, label, { fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace', fontSize: "30px", color: "#f9fafb", backgroundColor: "#1f2937", padding: { x: 24, y: 14 }, align: "center" }).setOrigin(0.5).setInteractive({ useHandCursor: true });
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
  constructor() { super(SCENE_KEYS.start); }
  create(): void {
    playRuntimeBgm("menu");
    const { width, height } = this.scale.gameSize;
    createCoverBackground(this, TEXTURE_KEYS.mainBackground, width, height);
    this.add.rectangle(0, 0, width, height, 0x08101b, 0.28).setOrigin(0);
    this.add.text(width / 2, height * 0.28, "TYPING ROGUELIKE", { fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace', fontSize: "48px", color: "#f9fafb" }).setOrigin(0.5);
    const startRunButton = createMenuButton(this, width / 2, height * 0.52, "게임 시작", async () => {
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
    createMenuButton(this, width / 2, height * 0.66, "설정", () => { const transition = resolveSceneTransition(SCENE_KEYS.settings, undefined); this.scene.start(transition.key, transition.payload); });
  }
}

export class SettingsScene extends EmptyCoreScene {
  private draftSettings: MenuSettings = DEFAULT_MENU_SETTINGS;
  private soundLabel?: Phaser.GameObjects.Text;
  constructor() { super(SCENE_KEYS.settings); }
  create(): void {
    playRuntimeBgm("menu");
    const { width, height } = this.scale.gameSize;
    const storage = typeof localStorage === "undefined" ? undefined : localStorage;
    this.draftSettings = loadMenuSettings(storage);
    this.add.rectangle(0, 0, width, height, 0x111827).setOrigin(0);
    this.add.text(width / 2, height * 0.24, "설정", { fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace', fontSize: "44px", color: "#f9fafb" }).setOrigin(0.5);
    this.soundLabel = createMenuButton(this, width / 2, height * 0.46, "", () => { this.draftSettings = toggleSound(this.draftSettings); this.refreshSoundLabel(); });
    this.refreshSoundLabel();
    createMenuButton(this, width / 2, height * 0.62, "적용", () => { saveMenuSettings(this.draftSettings, storage); this.sound.mute = !this.draftSettings.soundEnabled; setRuntimeAudioSettings({ muted: !this.draftSettings.soundEnabled, volume: this.draftSettings.volume }); });
    createMenuButton(this, width / 2, height * 0.76, "뒤로", () => { const transition = resolveSceneTransition(SCENE_KEYS.start, undefined); this.scene.start(transition.key, transition.payload); });
  }
  private refreshSoundLabel(): void { this.soundLabel?.setText(`효과음: ${this.draftSettings.soundEnabled ? "켜짐" : "꺼짐"}`); }
}

export class MapScene extends EmptyCoreScene {
  protected readonly renderLegacyMapChoices: boolean = true;
  private runState?: Readonly<RunState>;
  constructor() { super(SCENE_KEYS.map); }
  init(data: { runState?: Readonly<RunState> }): void { this.runState = data.runState; }
  create(): void {
    playRuntimeBgm("tower");
    const { width, height } = this.scale.gameSize;
    const activeRun = this.runState ?? runSession.get();
    createCoverBackground(this, TEXTURE_KEYS.mapBackground, width, height);
    if (activeRun === null || activeRun === undefined) { this.add.text(width / 2, height / 2, "런 상태를 찾을 수 없습니다.", { fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace', fontSize: "28px", color: "#fca5a5" }).setOrigin(0.5); return; }
    const view = createMapHudView(activeRun);
    const fontFamily = 'Galmuri9, "Apple SD Gothic Neo", monospace';
    const syncStatus = runRemotePersistence.syncStatus;
    const hudSideMargin = width < 960 ? 16 : 28;
    const hudPanelWidth = Phaser.Math.Clamp(Math.floor((width - 360) / 2), 220, 300);
    const leftHudX = hudSideMargin;
    this.add.text(width / 2, 42, `MAP · ${view.floor}F`, { fontFamily, fontSize: "36px", fontStyle: "bold", color: "#f9fafb" }).setOrigin(0.5);
    this.add.text(width / 2, 78, syncStatus.message, { fontFamily, fontSize: "14px", fontStyle: "bold", color: syncStatus.mode === "local_fallback" ? "#fbbf24" : "#9ca3af" }).setOrigin(0.5);
    this.add.text(leftHudX + 22, 110, "RUN HUD", { fontFamily, fontSize: "22px", fontStyle: "bold", color: "#45d78c" });
    this.add.text(leftHudX + 22, 150, `HP  ${view.hpText}`, { fontFamily, fontSize: "20px", fontStyle: "bold", color: "#45d78c" });
    this.add.text(leftHudX + 22, 184, `골드  ${view.currencyText}`, { fontFamily, fontSize: "20px", fontStyle: "bold", color: "#45d78c" });
    this.add.text(leftHudX + 22, 218, `장비  ${view.equipmentText}`, { fontFamily, fontSize: "18px", fontStyle: "bold", color: "#45d78c", wordWrap: { width: hudPanelWidth - 50 } });
    this.add.text(width / 2, 118, `현재 위치 · ${view.currentLocation}`, { fontFamily, fontSize: "22px", fontStyle: "bold", color: "#45d78c", align: "center", wordWrap: { width: Math.max(260, width - leftHudX - hudPanelWidth - 24) } }).setOrigin(0.5);
    this.add.text(width / 2, 172, `경로  ${view.pathText}`, { fontFamily, fontSize: "18px", fontStyle: "bold", color: "#9ca3af", align: "45d78c", wordWrap: { width: Math.max(260, width - leftHudX - hudPanelWidth - 24) } }).setOrigin(0.5);
    if (!this.renderLegacyMapChoices) return;
    const nodeXs = [width / 2 - 240, width / 2, width / 2 + 240];
    view.nodes.forEach((node, index) => { const x = nodeXs[index] ?? width / 2; this.add.rectangle(x, 500, 190, 116, node.status === "available" ? 0x2563eb : node.status === "cleared" ? 0x15803d : 0x374151).setOrigin(0.5); this.add.text(x, 500, node.type.toUpperCase(), { fontFamily, fontSize: "22px", color: "#ffffff" }).setOrigin(0.5); });
  }
}

export class ShopScene extends EmptyCoreScene { constructor() { super(SCENE_KEYS.shop); } }
export class RestScene extends EmptyCoreScene { constructor() { super(SCENE_KEYS.rest); } }
