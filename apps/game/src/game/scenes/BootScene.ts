import Phaser from "phaser";
import type { RunState } from "@typing-roguelike/shared";
import { RUNTIME_IMAGE_ASSETS, RUNTIME_SPRITESHEET_ASSETS, TEXTURE_KEYS } from "../assets/asset-catalog";
import { setRuntimeAudioSettings } from "../audio/runtime-audio";
import { runRemotePersistence } from "../run/run-remote-persistence";
import { resolveRunResumeRoute } from "../run/run-resume-routing";
import { runSession } from "../run/run-session";
import { applyMenuSettings, loadMenuSettings } from "./menu-settings";
import { SCENE_KEYS, resolveSceneTransition } from "./scene-contract";

export class BootScene extends Phaser.Scene {
  private static readonly MIN_LOADING_DURATION_MS = 1200;
  private static readonly FONT_FAMILY = 'Galmuri9, "Apple SD Gothic Neo", monospace';
  private failedAssetKeys = new Set<string>();
  private completedAssetKeys = new Set<string>();
  private loadingStartedAt = 0;
  private loadedAssetCount = 0;
  private totalAssetCount = 0;
  private loadingProgress = 0;
  private minimumLoadingTimer?: number;
  private minimumLoadingTimerResolve?: () => void;
  private bootGeneration = 0;
  private isShuttingDown = false;
  private loadingBackground?: Phaser.GameObjects.Image;
  private loadingLogo?: Phaser.GameObjects.Image;
  private loadingShade?: Phaser.GameObjects.Graphics;
  private progressPanel?: Phaser.GameObjects.Graphics;
  private progressTrack?: Phaser.GameObjects.Rectangle;
  private progressFill?: Phaser.GameObjects.Rectangle;
  private progressGlow?: Phaser.GameObjects.Rectangle;
  private loadingLabel?: Phaser.GameObjects.Text;
  private loadingMeta?: Phaser.GameObjects.Text;
  private loadingPercent?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.bootGeneration += 1;
    this.failedAssetKeys.clear();
    this.completedAssetKeys.clear();
    this.loadedAssetCount = 0;
    this.loadingProgress = 0;
    this.isShuttingDown = false;
    this.loadingStartedAt = performance.now();
    this.totalAssetCount = RUNTIME_IMAGE_ASSETS.length + RUNTIME_SPRITESHEET_ASSETS.length;
    this.createLoadingView();

    this.load.on(Phaser.Loader.Events.PROGRESS, this.handleLoadProgress, this);
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.handleFileComplete, this);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleFileLoadError, this);
    this.load.once(Phaser.Loader.Events.COMPLETE, this.handleLoadComplete, this);

    for (const asset of RUNTIME_IMAGE_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
    for (const asset of RUNTIME_SPRITESHEET_ASSETS) {
      this.load.spritesheet(asset.key, asset.path, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
      });
    }
  }

  create(): void {
    void this.finishBoot(this.bootGeneration);
  }

  private async finishBoot(bootGeneration: number): Promise<void> {
    const storage = typeof localStorage === "undefined" ? undefined : localStorage;
    const settings = loadMenuSettings(storage);
    applyMenuSettings(this, settings);
    setRuntimeAudioSettings({
      muted: !settings.soundEnabled,
      volume: settings.volume,
    });
    this.createFoundationTextures();

    for (const key of this.failedAssetKeys) {
      if (!this.textures.exists(key)) {
        this.createMissingTexture(key);
      }
    }

    const localRun = runSession.restore();
    const restoredRunPromise = runRemotePersistence.restore(localRun);
    const remainingLoadingTime = BootScene.MIN_LOADING_DURATION_MS - (performance.now() - this.loadingStartedAt);
    if (remainingLoadingTime > 0) {
      await this.waitForMinimumLoadingDuration(remainingLoadingTime);
    }

    if (!this.isBootActive(bootGeneration)) return;
    const restoredRun = await restoredRunPromise;
    if (!this.isBootActive(bootGeneration)) return;
    this.continueFromRestoredRun(restoredRun, bootGeneration);
  }

  private waitForMinimumLoadingDuration(durationMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.minimumLoadingTimerResolve = resolve;
      this.minimumLoadingTimer = window.setTimeout(() => {
        this.minimumLoadingTimer = undefined;
        this.minimumLoadingTimerResolve = undefined;
        resolve();
      }, durationMs);
    });
  }

  private createLoadingView(): void {
    this.loadingBackground = this.add.image(0, 0, TEXTURE_KEYS.loadingBackground).setOrigin(0.5).setDepth(-10);
    this.loadingShade = this.add.graphics().setDepth(-9);
    this.progressPanel = this.add.graphics().setDepth(10);
    this.progressTrack = this.add.rectangle(0, 0, 1, 1, 0x160d1c).setOrigin(0, 0.5).setDepth(11);
    this.progressFill = this.add.rectangle(0, 0, 1, 1, 0xffb938).setOrigin(0, 0.5).setDepth(12);
    this.progressGlow = this.add.rectangle(0, 0, 5, 10, 0xfff2b0).setOrigin(0.5).setDepth(13);
    this.loadingLogo = this.add.image(0, 0, TEXTURE_KEYS.brandLogo).setOrigin(0, 0).setDepth(5);
    this.loadingLabel = this.add
      .text(0, 0, "탑의 기록을 불러오는 중", {
        color: "#fff4d6",
        fontFamily: BootScene.FONT_FAMILY,
        fontSize: "14px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(14);
    this.loadingMeta = this.add
      .text(0, 0, `${this.loadedAssetCount} / ${this.totalAssetCount}`, {
        color: "#c5a4dc",
        fontFamily: BootScene.FONT_FAMILY,
        fontSize: "11px",
      })
      .setOrigin(1, 0.5)
      .setDepth(14);
    this.loadingPercent = this.add
      .text(0, 0, "0%", {
        color: "#fff0a5",
        fontFamily: BootScene.FONT_FAMILY,
        fontSize: "12px",
        fontStyle: "bold",
      })
      .setOrigin(1, 0.5)
      .setDepth(14);

    this.layoutLoadingView();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseLoadingListeners, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseLoadingListeners, this);
    this.tweens.add({ targets: this.progressGlow, alpha: 0.32, duration: 420, yoyo: true, repeat: -1 });
  }

  private layoutLoadingView(): void {
    const width = Math.max(1, this.scale.gameSize.width || this.scale.width);
    const height = Math.max(1, this.scale.gameSize.height || this.scale.height);
    const compact = width < 680 || height < 540;
    const panelHeight = compact ? 66 : 72;
    const panelMargin = compact ? 12 : 24;
    const panelWidth = Math.max(1, Math.min(width - (compact ? 24 : 80), 720));
    const panelX = (width - panelWidth) / 2;
    const panelY = Math.max(0, height - panelHeight - panelMargin);
    const logoTopMargin = compact ? 14 : 20;
    const logoBottomGap = compact ? 16 : 24;
    const logoAspect = this.loadingLogo === undefined ? 1 : this.loadingLogo.height / this.loadingLogo.width;
    const desiredLogoWidth = compact
      ? Math.min(Math.max(1, width - 36), 400)
      : Phaser.Math.Clamp(width * 0.42, 420, 620);
    const availableLogoHeight = Math.max(1, panelY - logoTopMargin - logoBottomGap);
    const logoHeight = Math.min(desiredLogoWidth * logoAspect, availableLogoHeight);
    const logoWidth = Math.max(1, logoHeight / logoAspect);
    const logoX = width < 520 ? (width - logoWidth) / 2 : Math.max(30, width * 0.04);
    const logoY = logoTopMargin;
    const barX = panelX + (compact ? 16 : 22);
    const barWidth = Math.max(1, panelWidth - (compact ? 32 : 44));

    if (this.loadingBackground !== undefined) {
      const coverScale = Math.max(width / this.loadingBackground.width, height / this.loadingBackground.height);
      this.loadingBackground.setPosition(width / 2, height / 2).setScale(coverScale);
    }
    this.drawLoadingShade(width, height, panelY);

    this.loadingLogo
      ?.setPosition(logoX, logoY)
      .setDisplaySize(logoWidth, logoWidth * (this.loadingLogo.height / this.loadingLogo.width));

    this.progressPanel?.clear();
    this.progressPanel?.fillStyle(0x090711, 0.9);
    this.progressPanel?.fillRect(panelX, panelY, panelWidth, panelHeight);
    this.progressPanel?.lineStyle(3, 0x1a101f, 1);
    this.progressPanel?.strokeRect(panelX, panelY, panelWidth, panelHeight);
    this.progressPanel?.lineStyle(1, 0x8d4ca7, 0.95);
    this.progressPanel?.strokeRect(panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8);
    this.progressPanel?.fillStyle(0xffb938, 1);
    this.progressPanel?.fillRect(panelX + 4, panelY + 4, 10, 3);
    this.progressPanel?.fillRect(panelX + panelWidth - 14, panelY + 4, 10, 3);

    const labelY = panelY + (compact ? 19 : 21);
    this.loadingLabel?.setPosition(barX, labelY);
    this.loadingMeta?.setPosition(panelX + panelWidth - (compact ? 16 : 22), labelY);
    const barY = panelY + (compact ? 44 : 48);
    this.progressTrack?.setPosition(barX, barY).setSize(barWidth, 10);
    this.progressFill?.setPosition(barX, barY).setSize(Math.max(1, barWidth * this.loadingProgress), 6);
    this.progressGlow?.setPosition(barX + barWidth * this.loadingProgress, barY).setSize(5, 12);
    this.loadingPercent?.setPosition(panelX + panelWidth - (compact ? 16 : 22), panelY + panelHeight - 11);
    this.loadingPercent?.setVisible(width >= 520);
  }

  private drawLoadingShade(width: number, height: number, panelY: number): void {
    const shade = this.loadingShade;
    if (shade === undefined) return;
    shade.clear();
    shade.fillGradientStyle(0x030108, 0x030108, 0x030108, 0x030108, 0.28, 0.06, 0.22, 0.22);
    shade.fillRect(0, 0, width, height);
    shade.fillGradientStyle(0x05030b, 0x05030b, 0x05030b, 0x05030b, 0, 0, 0.78, 0.78);
    shade.fillRect(0, Math.max(0, panelY - 90), width, height - panelY + 90);
  }

  private handleLoadProgress(progress: number): void {
    this.loadingProgress = Phaser.Math.Clamp(progress, 0, 1);
    this.refreshLoadingProgress();
  }

  private handleFileComplete(key: string): void {
    this.markAssetComplete(key);
  }

  private markAssetComplete(key: string): void {
    if (this.completedAssetKeys.has(key)) return;
    this.completedAssetKeys.add(key);
    this.loadedAssetCount = Math.min(this.totalAssetCount, this.loadedAssetCount + 1);
    this.loadingMeta?.setText(`${this.loadedAssetCount} / ${this.totalAssetCount}`);
  }

  private handleFileLoadError(file: Phaser.Loader.File): void {
    this.failedAssetKeys.add(file.key);
    this.markAssetComplete(file.key);
  }

  private handleLoadComplete(): void {
    this.loadingProgress = 1;
    this.loadingLabel?.setText("탑의 문을 여는 중");
    this.refreshLoadingProgress();
  }

  private refreshLoadingProgress(): void {
    const trackWidth = this.progressTrack?.width ?? 0;
    this.progressFill?.setSize(Math.max(1, trackWidth * this.loadingProgress), this.progressFill.height);
    this.progressGlow
      ?.setX((this.progressTrack?.x ?? 0) + trackWidth * this.loadingProgress)
      .setVisible(this.loadingProgress > 0);
    this.loadingPercent?.setText(`${Math.round(this.loadingProgress * 100)}%`);
  }

  private handleResize(): void {
    this.layoutLoadingView();
  }

  private releaseLoadingListeners(): void {
    this.bootGeneration += 1;
    this.isShuttingDown = true;
    if (this.minimumLoadingTimer !== undefined) {
      window.clearTimeout(this.minimumLoadingTimer);
      this.minimumLoadingTimer = undefined;
    }
    const resolveMinimumLoadingTimer = this.minimumLoadingTimerResolve;
    this.minimumLoadingTimerResolve = undefined;
    resolveMinimumLoadingTimer?.();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.load.off(Phaser.Loader.Events.PROGRESS, this.handleLoadProgress, this);
    this.load.off(Phaser.Loader.Events.FILE_COMPLETE, this.handleFileComplete, this);
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleFileLoadError, this);
    if (this.progressGlow !== undefined) {
      this.tweens.killTweensOf(this.progressGlow);
    }
  }

  private isBootActive(bootGeneration: number): boolean {
    return !this.isShuttingDown && bootGeneration === this.bootGeneration;
  }

  private continueFromRestoredRun(restoredRun: Readonly<RunState> | null, bootGeneration: number): void {
    if (!this.isBootActive(bootGeneration)) return;
    if (restoredRun === null) {
      const transition = resolveSceneTransition(SCENE_KEYS.start, undefined);
      this.scene.start(transition.key, transition.payload);
      return;
    }

    runSession.replace(restoredRun);
    const resume = resolveRunResumeRoute(restoredRun, runSession.getCheckpoint());
    const transition = resolveSceneTransition(resume.sceneKey, resume.payload);
    this.scene.start(transition.key, transition.payload);
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
