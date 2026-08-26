export const ASSET_PATHS = {
  weaponIcons: {
    hud: "/assets/images/weapon_icons_pixel/96",
    detail: "/assets/images/weapon_icons_pixel/192",
    manifest: "/assets/images/weapon_icons_pixel/manifest.csv",
  },
  fonts: "/assets/fonts",
  audio: "/assets/audio",
} as const;

/**
 * Only assets used by the current runtime foundation belong here.
 * Source images and overview sheets must remain outside the preload list.
 */
export const RUNTIME_IMAGE_ASSETS: readonly {
  key: string;
  path: string;
}[] = [];

export const RUNTIME_AUDIO_ASSETS: readonly {
  key: string;
  path: string;
}[] = [
  { key: "sfx:command-success", path: `${ASSET_PATHS.audio}/command-success.wav` },
  { key: "sfx:command-failure", path: `${ASSET_PATHS.audio}/command-failure.wav` },
  { key: "sfx:player-hit", path: `${ASSET_PATHS.audio}/player-hit.wav` },
  { key: "sfx:guard", path: `${ASSET_PATHS.audio}/guard.wav` },
  { key: "sfx:victory", path: `${ASSET_PATHS.audio}/victory.wav` },
  { key: "sfx:defeat", path: `${ASSET_PATHS.audio}/defeat.wav` },
];

export const TEXTURE_KEYS = {
  combatBackground: "placeholder:combat-background",
  missingAsset: "placeholder:missing-asset",
} as const;
