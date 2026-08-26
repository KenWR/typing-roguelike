import { COMBAT_BACKGROUND_ASSET, ENEMY_IMAGE_ASSETS } from "./enemy-visual-assets";
import { EFFECT_IMAGE_ASSETS } from "./effect-visual-assets";
import { EQUIPMENT_ICON_ASSETS } from "./equipment-icon-assets";
import { MAP_NODE_ICON_ASSET, MAP_NODE_ICON_TEXTURE_KEY } from "./map-node-assets";
import { PLAYER_ATTACK_IMAGE_ASSETS, PLAYER_WEAPON_IMAGE_ASSETS } from "./player-visual-assets";
import { RELIC_CONFIGS } from "@typing-roguelike/shared";

export const ASSET_PATHS = {
  backgrounds: {
    loading: "/assets/background/로딩 화면.webp",
    main: "/assets/background/메인 화면.png",
    map: "/assets/background/노드 선택 배경.png",
    shop: "/assets/background/상점.png",
    rest: "/assets/background/휴식.png",
  },
  weaponIcons: {
    hud: "/assets/images/weapon_icons_pixel/96",
    detail: "/assets/images/weapon_icons_pixel/192",
    manifest: "/assets/images/weapon_icons_pixel/manifest.csv",
  },
  relicIcons: {
    hud: "/assets/images/relic_icons/96",
    detail: "/assets/images/relic_icons/192",
    manifest: "/assets/images/relic_icons/manifest.csv",
  },
  ui: {
    brandLogo: "/assets/images/ui/typing-roguelike-logo.png",
  },
  fonts: "/assets/fonts",
} as const;

/** Loaded by PreBootScene so it is visible while the runtime asset queue runs. */
export const LOADING_SCREEN_ASSET = {
  key: "background:loading",
  path: ASSET_PATHS.backgrounds.loading,
} as const;

/** Loaded before BootScene so every entry screen uses the same brand mark. */
export const BRAND_LOGO_ASSET = {
  key: "ui:brand-logo",
  path: ASSET_PATHS.ui.brandLogo,
} as const;

export const getRelicIconTextureKey = (relicId: string): string => `relic-icon:${relicId}`;

/**
 * Only assets used by the current runtime foundation belong here.
 * Source images and overview sheets must remain outside the preload list.
 */
export const RELIC_ICON_ASSETS: readonly {
  key: string;
  path: string;
}[] = RELIC_CONFIGS.map((relic) => ({
  key: getRelicIconTextureKey(relic.id),
  path: `${ASSET_PATHS.relicIcons.hud}/${relic.id}.png`,
}));

export const COMBAT_IMAGE_ASSETS: readonly {
  key: string;
  path: string;
}[] = [
  COMBAT_BACKGROUND_ASSET,
  ...ENEMY_IMAGE_ASSETS,
  ...PLAYER_WEAPON_IMAGE_ASSETS,
  ...PLAYER_ATTACK_IMAGE_ASSETS,
  ...EFFECT_IMAGE_ASSETS,
];

export const SCENE_BACKGROUND_ASSETS: readonly {
  key: string;
  path: string;
}[] = [
  { key: "background:main", path: ASSET_PATHS.backgrounds.main },
  { key: "background:map", path: ASSET_PATHS.backgrounds.map },
  { key: "background:shop", path: ASSET_PATHS.backgrounds.shop },
  { key: "background:rest", path: ASSET_PATHS.backgrounds.rest },
];

export const RUNTIME_SPRITESHEET_ASSETS: readonly {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}[] = [MAP_NODE_ICON_ASSET];

/** The complete image catalog consumed by the BootScene preload boundary. */
export const RUNTIME_IMAGE_ASSETS: readonly {
  key: string;
  path: string;
}[] = [...RELIC_ICON_ASSETS, ...EQUIPMENT_ICON_ASSETS, ...COMBAT_IMAGE_ASSETS, ...SCENE_BACKGROUND_ASSETS];

export const TEXTURE_KEYS = {
  brandLogo: BRAND_LOGO_ASSET.key,
  loadingBackground: LOADING_SCREEN_ASSET.key,
  mainBackground: "background:main",
  mapBackground: "background:map",
  mapNodeIcons: MAP_NODE_ICON_TEXTURE_KEY,
  shopBackground: "background:shop",
  restBackground: "background:rest",
  combatBackground: COMBAT_BACKGROUND_ASSET.key,
  missingAsset: "placeholder:missing-asset",
} as const;
