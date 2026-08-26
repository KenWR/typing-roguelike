import Phaser from "phaser";
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
  constructor() {
    super(SCENE_KEYS.lobby);
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.add.rectangle(0, 0, width, height, 0x111827).setOrigin(0);
    this.add
      .text(width / 2, height * 0.38, "로비", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "48px",
        color: "#f9fafb",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.52, "게임 시작 흐름 연결 완료", {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "24px",
        color: "#9ca3af",
      })
      .setOrigin(0.5);
  }
}

export class MapScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.map);
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
