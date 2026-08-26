import { COMBAT_BACKGROUND_ASSET, ENEMY_IMAGE_ASSETS } from "./enemy-visual-assets";
import { EQUIPMENT_ICON_ASSETS } from "./equipment-icon-assets";
import { PLAYER_WEAPON_IMAGE_ASSETS } from "./player-visual-assets";
import { RELIC_CONFIGS } from "@typing-roguelike/shared";

export const ASSET_PATHS = {
  backgrounds: {
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
  fonts: "/assets/fonts",
} as const;

export const getRelicIconTextureKey = (relicId: string): string =>
  `relic-icon:${relicId}`;

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

/** The complete image catalog consumed by the BootScene preload boundary. */
export const RUNTIME_IMAGE_ASSETS: readonly {
  key: string;
  path: string;
}[] = [
  ...RELIC_ICON_ASSETS,
  ...EQUIPMENT_ICON_ASSETS,
  ...COMBAT_IMAGE_ASSETS,
  ...SCENE_BACKGROUND_ASSETS,
];

export const TEXTURE_KEYS = {
  mainBackground: "background:main",
  mapBackground: "background:map",
  shopBackground: "background:shop",
  restBackground: "background:rest",
  combatBackground: COMBAT_BACKGROUND_ASSET.key,
  missingAsset: "placeholder:missing-asset",
} as const;
