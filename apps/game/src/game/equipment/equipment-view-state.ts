import type {
  EquipmentAdapter,
  EquipmentDefinition,
  EquipmentSlot,
  EquipmentSnapshot,
  EquipmentSkill,
} from "./equipment-adapter";
import { EQUIPMENT_SLOTS, findEquipment } from "./equipment-adapter";

export type EquipmentViewState = Readonly<{
  snapshot: EquipmentSnapshot;
  activeSlot: EquipmentSlot;
  selectedEquipmentId: string;
}>;

export type EquipmentSkillComparison = Readonly<{
  before: EquipmentDefinition;
  after: EquipmentDefinition;
  added: readonly EquipmentSkill[];
  removed: readonly EquipmentSkill[];
}>;

export function createEquipmentViewState(
  snapshot: EquipmentSnapshot,
  initialSlot: EquipmentSlot = EQUIPMENT_SLOTS[0],
): EquipmentViewState {
  return {
    snapshot,
    activeSlot: initialSlot,
    selectedEquipmentId: snapshot.equippedBySlot[initialSlot],
  };
}

export function selectSlot(
  state: EquipmentViewState,
  slot: EquipmentSlot,
): EquipmentViewState {
  return {
    ...state,
    activeSlot: slot,
    selectedEquipmentId: state.snapshot.equippedBySlot[slot],
  };
}

export function selectEquipment(
  state: EquipmentViewState,
  equipmentId: string,
): EquipmentViewState {
  const equipment = findEquipment(state.snapshot, equipmentId);

  if (!equipment || equipment.slot !== state.activeSlot) {
    return state;
  }

  return {
    ...state,
    selectedEquipmentId: equipmentId,
  };
}

export function getSkillComparison(
  state: EquipmentViewState,
): EquipmentSkillComparison {
  const before = getEquipmentOrThrow(
    state.snapshot,
    state.snapshot.equippedBySlot[state.activeSlot],
  );
  const after = getEquipmentOrThrow(state.snapshot, state.selectedEquipmentId);
  const afterIds = new Set(after.skills.map((skill) => skill.id));
  const beforeIds = new Set(before.skills.map((skill) => skill.id));

  return {
    before,
    after,
    added: after.skills.filter((skill) => !beforeIds.has(skill.id)),
    removed: before.skills.filter((skill) => !afterIds.has(skill.id)),
  };
}

export function equipSelectedEquipment(
  state: EquipmentViewState,
  adapter: EquipmentAdapter,
): EquipmentViewState {
  const snapshot = adapter.equip(
    state.activeSlot,
    state.selectedEquipmentId,
  );

  return {
    ...state,
    snapshot,
    selectedEquipmentId: snapshot.equippedBySlot[state.activeSlot],
  };
}

function getEquipmentOrThrow(
  snapshot: EquipmentSnapshot,
  equipmentId: string,
): EquipmentDefinition {
  const equipment = findEquipment(snapshot, equipmentId);

  if (!equipment) {
    throw new Error(`Equipment snapshot is missing ${equipmentId}.`);
  }

  return equipment;
}
