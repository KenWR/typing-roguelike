import { EQUIPMENT_CONFIGS, type EquipmentKind } from "@typing-roguelike/shared";

const PLAYER_IMAGE_BY_WEAPON_KIND = {
  sword: "/assets/weapons/player-sword.png",
  greatsword: "/assets/weapons/player-greatsword.png",
  wand: "/assets/weapons/player-wand.png",
  staff: "/assets/weapons/player-staff.png",
  bow: "/assets/weapons/player-bow.png",
  crossbow: "/assets/weapons/player-crossbow.png",
  mace: "/assets/weapons/player-mace.png",
  club: "/assets/weapons/player-club.png",
} as const satisfies Partial<Record<EquipmentKind, string>>;

const playerTextureKey = (kind: keyof typeof PLAYER_IMAGE_BY_WEAPON_KIND): string =>
  `player:${kind}`;

export const PLAYER_WEAPON_IMAGE_ASSETS = Object.entries(
  PLAYER_IMAGE_BY_WEAPON_KIND,
).map(([kind, path]) => ({
  key: playerTextureKey(kind as keyof typeof PLAYER_IMAGE_BY_WEAPON_KIND),
  path,
}));

export const resolvePlayerTextureKey = (
  primaryWeaponId: string | undefined,
): string | undefined => {
  if (primaryWeaponId === undefined) return undefined;
  const kind = EQUIPMENT_CONFIGS.find(
    (equipment) => equipment.id === primaryWeaponId && equipment.slot === "weapon",
  )?.kind;
  return kind !== undefined && kind in PLAYER_IMAGE_BY_WEAPON_KIND
    ? playerTextureKey(kind as keyof typeof PLAYER_IMAGE_BY_WEAPON_KIND)
    : undefined;
};