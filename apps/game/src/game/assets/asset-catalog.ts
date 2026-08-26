import { COMBAT_BACKGROUND_ASSET, ENEMY_IMAGE_ASSETS } from "./enemy-visual-assets";
import { PLAYER_WEAPON_IMAGE_ASSETS } from "./player-visual-assets";
import { RELIC_CONFIGS } from "@typing-roguelike/shared";

export const ASSET_PATHS = {
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

export const TEXTURE_KEYS = {
  combatBackground: COMBAT_BACKGROUND_ASSET.key,
  missingAsset: "placeholder:missing-asset",
} as const;
