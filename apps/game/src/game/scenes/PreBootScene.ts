import Phaser from "phaser";
import { BRAND_LOGO_ASSET, LOADING_SCREEN_ASSET } from "../assets/asset-catalog";
import { SCENE_KEYS } from "./scene-contract";

const PRE_BOOT_SCENE_KEY = "PreBootScene";

/** Loads the splash artwork before the main runtime asset queue begins. */
export class PreBootScene extends Phaser.Scene {
  private immediateLoadingPanel?: Phaser.GameObjects.Graphics;
  private immediateLoadingTrack?: Phaser.GameObjects.Rectangle;
  private immediateLoadingFill?: Phaser.GameObjects.Rectangle;
  private immediateLoadingLabel?: Phaser.GameObjects.Text;
  private immediateLoadingProgress = 0;

  constructor() {
    super(PRE_BOOT_SCENE_KEY);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor("#05030b");
    this.immediateLoadingProgress = 0;
    this.createImmediateLoadingView();
    this.load.on(Phaser.Loader.Events.PROGRESS, this.handleLoadingProgress, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseImmediateLoadingView, this);
    this.load.image(LOADING_SCREEN_ASSET.key, LOADING_SCREEN_ASSET.path);
    this.load.image(BRAND_LOGO_ASSET.key, BRAND_LOGO_ASSET.path);
  }

  create(): void {
    this.releaseImmediateLoadingView();
    for (const asset of [LOADING_SCREEN_ASSET, BRAND_LOGO_ASSET]) {
      this.textures.get(asset.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.scene.start(SCENE_KEYS.boot);
  }

  private createImmediateLoadingView(): void {
    this.immediateLoadingPanel = this.add.graphics().setDepth(10);
    this.immediateLoadingTrack = this.add.rectangle(0, 0, 1, 8, 0x160d1c).setOrigin(0, 0.5).setDepth(11);
    this.immediateLoadingFill = this.add.rectangle(0, 0, 1, 4, 0xffb938).setOrigin(0, 0.5).setDepth(12);
    this.immediateLoadingLabel = this.add
      .text(0, 0, "게임을 준비하는 중", {
        color: "#fff4d6",
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "14px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(13);
    this.layoutImmediateLoadingView();
  }

  private layoutImmediateLoadingView(): void {
    const width = Math.max(1, this.scale.gameSize.width || this.scale.width);
    const height = Math.max(1, this.scale.gameSize.height || this.scale.height);
    const panelWidth = Math.max(1, Math.min(width - 32, 520));
    const panelHeight = 88;
    const panelX = (width - panelWidth) / 2;
    const panelY = Math.max(16, (height - panelHeight) / 2);
    const barX = panelX + 20;
    const barWidth = Math.max(1, panelWidth - 40);

    this.immediateLoadingPanel?.clear();
    this.immediateLoadingPanel?.fillStyle(0x090711, 0.96);
    this.immediateLoadingPanel?.fillRect(panelX, panelY, panelWidth, panelHeight);
    this.immediateLoadingPanel?.lineStyle(2, 0x8d4ca7, 0.95);
    this.immediateLoadingPanel?.strokeRect(panelX, panelY, panelWidth, panelHeight);
    this.immediateLoadingLabel?.setPosition(width / 2, panelY + 26);
    this.immediateLoadingTrack?.setPosition(barX, panelY + 61).setSize(barWidth, 8);
    this.immediateLoadingFill
      ?.setPosition(barX, panelY + 61)
      .setSize(Math.max(1, barWidth * this.immediateLoadingProgress), 4);
  }

  private handleLoadingProgress(progress: number): void {
    this.immediateLoadingProgress = Phaser.Math.Clamp(progress, 0, 1);
    this.layoutImmediateLoadingView();
  }

  private handleResize(): void {
    this.layoutImmediateLoadingView();
  }

  private releaseImmediateLoadingView(): void {
    this.load.off(Phaser.Loader.Events.PROGRESS, this.handleLoadingProgress, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.immediateLoadingPanel?.destroy();
    this.immediateLoadingTrack?.destroy();
    this.immediateLoadingFill?.destroy();
    this.immediateLoadingLabel?.destroy();
    this.immediateLoadingPanel = undefined;
    this.immediateLoadingTrack = undefined;
    this.immediateLoadingFill = undefined;
    this.immediateLoadingLabel = undefined;
  }
}
