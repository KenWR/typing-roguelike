export const ASSET_PATHS = {
  weaponIcons: {
    hud: "/assets/images/weapon_icons_pixel/96",
    detail: "/assets/images/weapon_icons_pixel/192",
    manifest: "/assets/images/weapon_icons_pixel/manifest.csv",
  },
  fonts: "/assets/fonts",
} as const;

/**
 * Only assets used by the current runtime foundation belong here.
 * Source images and overview sheets must remain outside the preload list.
 */
export const RUNTIME_IMAGE_ASSETS: readonly {
  key: string;
  path: string;
}[] = [];

export const TEXTURE_KEYS = {
  combatBackground: "placeholder:combat-background",
  missingAsset: "placeholder:missing-asset",
} as const;
