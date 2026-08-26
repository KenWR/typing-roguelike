import {
  EQUIPMENT_BY_ID,
  RELIC_BY_ID,
  type EquipmentConfig,
  type RelicConfig,
  type Rarity,
  type RunState,
} from "@typing-roguelike/shared";

const LOADOUT_ITEM_KEYS = [
  "weaponId",
  "subweaponId",
  "ring1Id",
  "ring2Id",
] as const;

export type InventoryEquipmentSlot = EquipmentConfig["slot"] | "unknown";

export type InventoryEquipmentSkillView = Readonly<{
  id: string;
  name: string;
  command: string;
  effect: string;
}>;

export type InventoryEquipmentView = Readonly<{
  id: string;
  name: string;
  rarity: Rarity;
  slot: InventoryEquipmentSlot;
  isEquipped: boolean;
  skills: readonly InventoryEquipmentSkillView[];
}>;

export type InventoryRelicView = Readonly<{
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  isActive: boolean;
}>;

export type InventoryView = Readonly<{
  equipment: readonly InventoryEquipmentView[];
  relics: readonly InventoryRelicView[];
}>;

const relicById = RELIC_BY_ID as ReadonlyMap<string, RelicConfig>;

const getSkillEffect = (description: string, effect: string | undefined): string => {
  const trimmedEffect = effect?.trim();
  return trimmedEffect === undefined || trimmedEffect.length === 0
    ? description
    : trimmedEffect;
};

export const createInventoryView = (
  runState: Readonly<RunState>,
): InventoryView => {
  const equippedEquipmentIds = new Set(
    LOADOUT_ITEM_KEYS.map((key) => runState.loadout[key]).filter(
      (id): id is string => id !== null,
    ),
  );
  const activeRelicIds = new Set(runState.build.equippedRelicIds);

  const equipment = runState.inventory.itemInstances.map((id) => {
    const config = EQUIPMENT_BY_ID.get(id);
    if (config === undefined) {
      return {
        id,
        name: id,
        rarity: "common" as const,
        slot: "unknown" as const,
        isEquipped: equippedEquipmentIds.has(id),
        skills: [
          {
            id: `${id}:unknown-effect`,
            name: "효과 정보 없음",
            command: "-",
            effect: "등록되지 않은 장비입니다.",
          },
        ],
      } satisfies InventoryEquipmentView;
    }

    return {
      id: config.id,
      name: config.name,
      rarity: config.rarity,
      slot: config.slot,
      isEquipped: equippedEquipmentIds.has(config.id),
      skills: config.skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        command: skill.command,
        effect: getSkillEffect(skill.description, skill.effect),
      })),
    } satisfies InventoryEquipmentView;
  });

  const relics = runState.inventory.relicInstances.map((id) => {
    const config = relicById.get(id);
    return {
      id,
      name: config?.name ?? id,
      rarity: config?.rarity ?? "common",
      description: config?.description ?? "등록되지 않은 유물입니다.",
      isActive: activeRelicIds.has(id),
    } satisfies InventoryRelicView;
  });

  return { equipment, relics };
};
