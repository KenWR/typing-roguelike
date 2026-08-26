import Phaser from "phaser";
import { BRAND_LOGO_ASSET, LOADING_SCREEN_ASSET } from "../assets/asset-catalog";
import { SCENE_KEYS } from "./scene-contract";

const PRE_BOOT_SCENE_KEY = "PreBootScene";

/** Loads the splash artwork before the main runtime asset queue begins. */
export class PreBootScene extends Phaser.Scene {
  constructor() {
    super(PRE_BOOT_SCENE_KEY);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor("#05030b");
    this.load.image(LOADING_SCREEN_ASSET.key, LOADING_SCREEN_ASSET.path);
    this.load.image(BRAND_LOGO_ASSET.key, BRAND_LOGO_ASSET.path);
  }

  create(): void {
    for (const asset of [LOADING_SCREEN_ASSET, BRAND_LOGO_ASSET]) {
      this.textures.get(asset.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.scene.start(SCENE_KEYS.boot);
  }
}
