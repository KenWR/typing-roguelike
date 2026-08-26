import { EQUIPMENT_BY_ID } from "../content/equipment.ts";
import type { EquipmentConfig } from "../content/types.ts";
import type { RunState } from "../contracts/backend/run-state.ts";

export type EquipmentCarryCategory =
  | "one-handed-weapon"
  | "two-handed-weapon"
  | "subweapon";

export type CombatLoadoutMode = "one-handed" | "two-handed";

export type CombatLoadoutOption = Readonly<{
  mode: CombatLoadoutMode;
  weaponId: string;
  subweaponId: string | null;
}>;

/** Greatswords are the only two-handed weapons in the current equipment set. */
export const isTwoHandedWeapon = (equipment: EquipmentConfig): boolean =>
  equipment.slot === "weapon" && equipment.kind === "greatsword";

export const getEquipmentCarryCategory = (
  equipment: EquipmentConfig,
): EquipmentCarryCategory => {
  if (equipment.slot === "subweapon") return "subweapon";
  return isTwoHandedWeapon(equipment)
    ? "two-handed-weapon"
    : "one-handed-weapon";
};

const getOwnedEquipment = (runState: Readonly<RunState>): EquipmentConfig[] =>
  runState.inventory.itemInstances.flatMap((id) => {
    const equipment = EQUIPMENT_BY_ID.get(id);
    return equipment === undefined ? [] : [equipment];
  });

/**
 * Adds an equipment reward while keeping one item per carry category.
 * Replacing an item also clears stale references from the active loadout.
 */
export const applyEquipmentAcquisition = (
  runState: Readonly<RunState>,
  equipment: EquipmentConfig,
): RunState => {
  const category = getEquipmentCarryCategory(equipment);
  const replacedIds = new Set(
    getOwnedEquipment(runState)
      .filter((candidate) =>
        candidate.id !== equipment.id &&
        getEquipmentCarryCategory(candidate) === category,
      )
      .map((candidate) => candidate.id),
  );
  const itemInstances = [
    ...runState.inventory.itemInstances.filter(
      (id) => id !== equipment.id && !replacedIds.has(id),
    ),
    equipment.id,
  ];
  const loadout = { ...runState.loadout };
  for (const slot of ["weaponId", "subweaponId"] as const) {
    if (loadout[slot] !== null && replacedIds.has(loadout[slot])) {
      loadout[slot] = null;
    }
  }
  if (equipment.slot === "subweapon") {
    loadout.subweaponId = equipment.id;
  } else {
    loadout.weaponId = equipment.id;
  }

  return {
    ...runState,
    inventory: { ...runState.inventory, itemInstances },
    loadout,
  };
};

const findOwned = (
  runState: Readonly<RunState>,
  predicate: (equipment: EquipmentConfig) => boolean,
): EquipmentConfig | undefined => getOwnedEquipment(runState).find(predicate);

export const getCombatLoadoutOptions = (
  runState: Readonly<RunState>,
): readonly CombatLoadoutOption[] => {
  const oneHanded = findOwned(
    runState,
    (equipment) =>
      equipment.slot === "weapon" && !isTwoHandedWeapon(equipment),
  );
  const twoHanded = findOwned(runState, isTwoHandedWeapon);
  const subweapon = findOwned(
    runState,
    (equipment) => equipment.slot === "subweapon",
  );
  return [
    ...(oneHanded === undefined
      ? []
      : [{ mode: "one-handed" as const, weaponId: oneHanded.id, subweaponId: subweapon?.id ?? null }]),
    ...(twoHanded === undefined
      ? []
      : [{ mode: "two-handed" as const, weaponId: twoHanded.id, subweaponId: null }]),
  ];
};

export const selectCombatLoadout = (
  runState: Readonly<RunState>,
  mode: CombatLoadoutMode,
): RunState => {
  const option = getCombatLoadoutOptions(runState).find(
    (candidate) => candidate.mode === mode,
  );
  if (option === undefined) {
    throw new RangeError(`Combat loadout is unavailable: ${mode}`);
  }
  return {
    ...runState,
    loadout: {
      ...runState.loadout,
      weaponId: option.weaponId,
      subweaponId: option.subweaponId,
    },
  };
};
