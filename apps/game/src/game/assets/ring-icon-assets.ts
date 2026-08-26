import { RING_CONFIGS } from "@typing-roguelike/shared";

const RING_ICON_DIRECTORY = "/assets/rings";

/** Ring ids are kept explicit so a renamed asset cannot silently break the HUD. */
const RING_ICON_FILE_BY_ID: Readonly<Record<string, string>> = {
  ring_swift_prefix: "swiftness_sigil_ring",
  ring_economy_prefix: "focus_sigil_ring",
  ring_fury_prefix: "blood_sigil_ring",
  ring_chain_suffix: "chaining_ending_ring",
  ring_bleed_suffix: "piercing_ending_ring",
  ring_heavy_suffix: "weight_sigil_ring",
  ring_weight_prefix: "weight_sigil_ring",
  ring_blood_prefix: "blood_sigil_ring",
  ring_focus_prefix: "focus_sigil_ring",
  ring_reversal_prefix: "reversal_sigil_ring",
  ring_echo_prefix: "echo_sigil_ring",
  ring_double_suffix: "double_ending_ring",
  ring_reclaim_suffix: "reclaim_ending_ring",
  ring_piercing_suffix: "piercing_ending_ring",
  ring_chaining_suffix: "chaining_ending_ring",
  ring_infinite_suffix: "infinite_ending_ring",
  ring_final_suffix: "final_ending_ring",
};

export const getRingIconTextureKey = (ringId: string): string => `ring-icon:${ringId}`;

export const resolveRingIconTextureKey = (ringId: string): string | undefined =>
  RING_ICON_FILE_BY_ID[ringId] === undefined ? undefined : getRingIconTextureKey(ringId);

export const RING_ICON_ASSETS: readonly { key: string; path: string }[] = RING_CONFIGS.flatMap((ring) => {
  const file = RING_ICON_FILE_BY_ID[ring.id];
  return file === undefined
    ? []
    : [{ key: getRingIconTextureKey(ring.id), path: `${RING_ICON_DIRECTORY}/${file}.png` }];
});

export const RING_ICON_IDS_WITHOUT_ASSET: readonly string[] = RING_CONFIGS.filter(
  (ring) => RING_ICON_FILE_BY_ID[ring.id] === undefined,
).map((ring) => ring.id);
