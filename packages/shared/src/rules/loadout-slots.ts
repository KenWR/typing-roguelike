import type { RunLoadoutState } from "../contracts/backend/run-state.ts";

export type LoadoutItemType = "weapon" | "subweapon" | "ring";
export type LoadoutSlot = keyof RunLoadoutState;

export const LOADOUT_SLOTS = [
  "weaponId",
  "subweaponId",
  "ring1Id",
  "ring2Id",
] as const satisfies readonly LoadoutSlot[];

const SLOT_ITEM_TYPE: Readonly<Record<LoadoutSlot, LoadoutItemType>> = {
  weaponId: "weapon",
  subweaponId: "subweapon",
  ring1Id: "ring",
  ring2Id: "ring",
};

export type EquipLoadoutItemInput = Readonly<{
  loadout: Readonly<RunLoadoutState>;
  itemId: string;
  itemType: LoadoutItemType;
  targetSlot: LoadoutSlot;
}>;

export type EquipLoadoutItemResult = Readonly<{
  loadout: RunLoadoutState;
  targetSlot: LoadoutSlot;
  equippedItemId: string;
  replacedItemId: string | null;
}>;

export const getLoadoutSlotItemType = (slot: LoadoutSlot): LoadoutItemType =>
  SLOT_ITEM_TYPE[slot];

export const canEquipLoadoutItem = (
  itemType: LoadoutItemType,
  targetSlot: LoadoutSlot,
): boolean => getLoadoutSlotItemType(targetSlot) === itemType;

export const equipLoadoutItem = ({
  loadout,
  itemId,
  itemType,
  targetSlot,
}: EquipLoadoutItemInput): EquipLoadoutItemResult => {
  const normalizedItemId = itemId.trim();
  if (normalizedItemId.length === 0) {
    throw new RangeError("Loadout item id must not be empty.");
  }

  if (!canEquipLoadoutItem(itemType, targetSlot)) {
    throw new RangeError(
      `Cannot equip ${itemType} item in ${targetSlot} (${getLoadoutSlotItemType(targetSlot)} slot).`,
    );
  }

  const replacedItemId = loadout[targetSlot];
  return {
    loadout: {
      ...loadout,
      [targetSlot]: normalizedItemId,
    },
    targetSlot,
    equippedItemId: normalizedItemId,
    replacedItemId,
  };
};

export const unequipLoadoutSlot = (
  loadout: Readonly<RunLoadoutState>,
  targetSlot: LoadoutSlot,
): RunLoadoutState => ({
  ...loadout,
  [targetSlot]: null,
});
