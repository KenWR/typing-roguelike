const EFFECT_ASSET_IDS = [
  "accuracy-down",
  "ap-regen-down",
  "ap-regen-up",
  "bleed",
  "burning-bleed",
  "crack",
  "eclipse-mark",
  "enemy-delay",
  "guard",
  "oath",
  "shield",
  "stun",
  "time-stop",
  "weaken",
] as const;

export type EffectAssetId = (typeof EFFECT_ASSET_IDS)[number];

export const getEffectTextureKey = (effectId: EffectAssetId): string =>
  `effect:${effectId}`;

export const EFFECT_IMAGE_ASSETS: readonly { key: string; path: string }[] =
  EFFECT_ASSET_IDS.map((effectId) => ({
    key: getEffectTextureKey(effectId),
    path: `/assets/images/effects/${effectId}.png`,
  }));

const EFFECT_ID_ALIASES: Readonly<Record<string, EffectAssetId>> = {
  accuracy: "accuracy-down",
  "accuracy-down": "accuracy-down",
  "ap-regen-down": "ap-regen-down",
  "ap-regeneration-down": "ap-regen-down",
  "ap-regen-up": "ap-regen-up",
  "ap-regeneration-up": "ap-regen-up",
  bleed: "bleed",
  "burning-bleed": "burning-bleed",
  crack: "crack",
  fracture: "crack",
  "eclipse-mark": "eclipse-mark",
  "enemy-delay": "enemy-delay",
  delay: "enemy-delay",
  guard: "guard",
  oath: "oath",
  shield: "shield",
  stun: "stun",
  "time-stop": "time-stop",
  weaken: "weaken",
} as const;

const normalizeEffectId = (effectId: string): string =>
  effectId.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");

export const resolveEffectTextureKey = (
  effectId: string,
): string | undefined => {
  const assetId = EFFECT_ID_ALIASES[normalizeEffectId(effectId)];
  return assetId === undefined ? undefined : getEffectTextureKey(assetId);
};
