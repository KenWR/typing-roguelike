import Phaser from "phaser";
import {
  RUNTIME_IMAGE_ASSETS,
  TEXTURE_KEYS,
} from "../assets/asset-catalog";

export class BootScene extends Phaser.Scene {
  private failedAssetKeys = new Set<string>();

  constructor() {
    super("BootScene");
  }

  preload(): void {
    const { width, height } = this.scale.gameSize;
    const progressTrack = this.add
      .rectangle(width / 2, height / 2, Math.min(width * 0.5, 420), 12, 0x263449)
      .setOrigin(0.5);
    const progressFill = this.add
      .rectangle(
        progressTrack.x - progressTrack.displayWidth / 2,
        height / 2,
        0,
        8,
        0x4fd1c5,
      )
      .setOrigin(0, 0.5);
    const loadingLabel = this.add
      .text(width / 2, height / 2 - 32, "에셋 불러오는 중", {
        color: "#d7e2ee",
        fontFamily: "Galmuri9, monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      progressFill.width = progressTrack.width * progress;
    });
    this.load.on(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      (file: Phaser.Loader.File) => {
        this.failedAssetKeys.add(file.key);
      },
    );
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      progressTrack.destroy();
      progressFill.destroy();
      loadingLabel.destroy();
    });

    for (const asset of RUNTIME_IMAGE_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
  }

  create(): void {
    this.createFoundationTextures();

    for (const key of this.failedAssetKeys) {
      if (!this.textures.exists(key)) {
        this.createMissingTexture(key);
      }
    }

    this.scene.start("CombatFoundationScene");
  }

  private createFoundationTextures(): void {
    if (!this.textures.exists(TEXTURE_KEYS.combatBackground)) {
      const background = this.make.graphics({ x: 0, y: 0 }, false);
      background.fillGradientStyle(0x101827, 0x101827, 0x252d3b, 0x161d2a, 1);
      background.fillRect(0, 0, 1600, 900);
      background.lineStyle(2, 0x3a4658, 0.28);
      for (let x = 80; x < 1600; x += 160) {
        background.lineBetween(x, 0, x - 180, 900);
      }
      background.generateTexture(TEXTURE_KEYS.combatBackground, 1600, 900);
      background.destroy();
    }

    if (!this.textures.exists(TEXTURE_KEYS.missingAsset)) {
      this.createMissingTexture(TEXTURE_KEYS.missingAsset);
    }
  }

  private createMissingTexture(key: string): void {
    const missing = this.make.graphics({ x: 0, y: 0 }, false);
    missing.fillStyle(0x291d2b, 1);
    missing.fillRect(0, 0, 128, 128);
    missing.lineStyle(6, 0xc05a67, 1);
    missing.lineBetween(16, 16, 112, 112);
    missing.lineBetween(112, 16, 16, 112);
    missing.generateTexture(key, 128, 128);
    missing.destroy();
  }
}
