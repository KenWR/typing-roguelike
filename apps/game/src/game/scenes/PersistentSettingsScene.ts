import Phaser from "phaser";
import { setRuntimeAudioSettings } from "../audio/runtime-audio";
import {
  DEFAULT_MENU_SETTINGS,
  applyMenuSettings,
  cycleVolume,
  loadMenuSettings,
  saveMenuSettings,
  toggleCommandLanguage,
  toggleScreenShake,
  toggleSound,
  type MenuSettings,
} from "./menu-settings";
import { SCENE_KEYS, resolveSceneTransition } from "./scene-contract";

const createButton = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  onClick: () => void,
): Phaser.GameObjects.Text => scene.add.text(x, y, "", {
  fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
  fontSize: "24px",
  color: "#f9fafb",
  backgroundColor: "#1f2937",
  padding: { x: 18, y: 10 },
  align: "center",
}).setOrigin(0.5).setInteractive({ useHandCursor: true }).on("pointerdown", onClick);

export class SettingsScene extends Phaser.Scene {
  private draft: MenuSettings = DEFAULT_MENU_SETTINGS;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super(SCENE_KEYS.settings);
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    const storage = typeof localStorage === "undefined" ? undefined : localStorage;
    this.draft = loadMenuSettings(storage);
    applyMenuSettings(this, this.draft);

    this.add.rectangle(0, 0, width, height, 0x111827).setOrigin(0);
    this.add.text(width / 2, 54, "설정", {
      fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
      fontSize: "40px",
      color: "#f9fafb",
    }).setOrigin(0.5);

    const updateDraft = (next: MenuSettings): void => {
      this.draft = next;
      applyMenuSettings(this, this.draft);
      setRuntimeAudioSettings({
        muted: !this.draft.soundEnabled,
        volume: this.draft.volume,
      });
      this.refresh();
    };

    const actions = [
      () => updateDraft(toggleSound(this.draft)),
      () => updateDraft(cycleVolume(this.draft)),
      () => updateDraft(toggleScreenShake(this.draft)),
      () => updateDraft(toggleCommandLanguage(this.draft)),
    ];

    this.labels = actions.map((action, index) => createButton(this, width / 2, 130 + index * 70, action));
    this.refresh();

    createButton(this, width / 2, 440, () => {
      saveMenuSettings(this.draft, storage);
      applyMenuSettings(this, this.draft);
      setRuntimeAudioSettings({
        muted: !this.draft.soundEnabled,
        volume: this.draft.volume,
      });
      this.refresh();
    }).setText("적용");

    createButton(this, width / 2, 510, () => {
      const transition = resolveSceneTransition(SCENE_KEYS.start, undefined);
      this.scene.start(transition.key, transition.payload);
    }).setText("뒤로");
  }

  private refresh(): void {
    this.labels[0]?.setText(`효과음: ${this.draft.soundEnabled ? "켜짐" : "꺼짐"}`);
    this.labels[1]?.setText(`음량: ${Math.round(this.draft.volume * 100)}%`);
    this.labels[2]?.setText(`화면 흔들림: ${this.draft.screenShakeEnabled ? "켜짐" : "꺼짐"}`);
    this.labels[3]?.setText(`커맨드 표시 언어: ${this.draft.commandLanguage === "ko" ? "한국어" : "English"}`);
  }
}
