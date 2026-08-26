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

const PLAYER_ATTACK_IMAGE_BY_WEAPON_KIND = {
  sword: "/assets/images/player-attacks/sword.png",
  greatsword: "/assets/images/player-attacks/greatsword.png",
  wand: "/assets/images/player-attacks/wand.png",
  staff: "/assets/images/player-attacks/staff.png",
  bow: "/assets/images/player-attacks/bow.png",
  crossbow: "/assets/images/player-attacks/crossbow.png",
  mace: "/assets/images/player-attacks/mace.png",
  club: "/assets/images/player-attacks/club.png",
} as const satisfies Partial<Record<EquipmentKind, string>>;

type PlayerWeaponKind = keyof typeof PLAYER_IMAGE_BY_WEAPON_KIND;

const resolvePlayerWeaponKind = (
  primaryWeaponId: string | undefined,
): PlayerWeaponKind | undefined => {
  if (primaryWeaponId === undefined) return undefined;
  const kind = EQUIPMENT_CONFIGS.find(
    (equipment) => equipment.id === primaryWeaponId && equipment.slot === "weapon",
  )?.kind;
  return kind !== undefined && kind in PLAYER_IMAGE_BY_WEAPON_KIND
    ? kind as PlayerWeaponKind
    : undefined;
};

const playerTextureKey = (kind: keyof typeof PLAYER_IMAGE_BY_WEAPON_KIND): string =>
  `player:${kind}`;

export const PLAYER_WEAPON_IMAGE_ASSETS = Object.entries(
  PLAYER_IMAGE_BY_WEAPON_KIND,
).map(([kind, path]) => ({
  key: playerTextureKey(kind as keyof typeof PLAYER_IMAGE_BY_WEAPON_KIND),
  path,
}));

export const PLAYER_ATTACK_IMAGE_ASSETS: readonly {
  key: string;
  path: string;
}[] = [
  ...Object.entries(PLAYER_ATTACK_IMAGE_BY_WEAPON_KIND).map(([kind, path]) => ({
    key: `player:${kind}:attack`,
    path,
  })),
  {
    key: "player:bow:attack-special",
    path: "/assets/images/player-attacks/bow-special.png",
  },
];

export const resolvePlayerTextureKey = (
  primaryWeaponId: string | undefined,
): string | undefined => {
  const kind = resolvePlayerWeaponKind(primaryWeaponId);
  return kind === undefined ? undefined : playerTextureKey(kind);
};

export const resolvePlayerAttackTextureKey = (
  primaryWeaponId: string | undefined,
  skillCategory: "basic" | "special" | "guard",
): string | undefined => {
  const kind = resolvePlayerWeaponKind(primaryWeaponId);
  if (kind === undefined) return undefined;
  return kind === "bow" && skillCategory === "special"
    ? "player:bow:attack-special"
    : `player:${kind}:attack`;
};
