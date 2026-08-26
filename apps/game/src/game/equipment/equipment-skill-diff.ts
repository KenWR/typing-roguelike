import {
  EQUIPMENT_SLOTS,
  type EquipmentSkill,
  type EquipmentSnapshot,
} from "./equipment-adapter";

export type EquipmentSkillDiff = Readonly<{
  before: readonly EquipmentSkill[];
  after: readonly EquipmentSkill[];
  added: readonly EquipmentSkill[];
  removed: readonly EquipmentSkill[];
}>;

const cloneSkill = (skill: EquipmentSkill): EquipmentSkill => ({ ...skill });

const indexSkillsById = (
  skills: readonly EquipmentSkill[],
): ReadonlyMap<string, EquipmentSkill> => {
  const indexed = new Map<string, EquipmentSkill>();

  for (const skill of skills) {
    if (!indexed.has(skill.id)) {
      indexed.set(skill.id, skill);
    }
  }

  return indexed;
};

export function getEquippedSkills(
  snapshot: EquipmentSnapshot,
): readonly EquipmentSkill[] {
  const equipmentById = new Map(
    snapshot.ownedEquipment.map((equipment) => [equipment.id, equipment]),
  );
  const skillsById = new Map<string, EquipmentSkill>();

  for (const slot of EQUIPMENT_SLOTS) {
    const equipmentId = snapshot.equippedBySlot[slot];
    const equipment = equipmentById.get(equipmentId);

    if (!equipment) {
      continue;
    }

    for (const skill of equipment.skills) {
      if (!skillsById.has(skill.id)) {
        skillsById.set(skill.id, cloneSkill(skill));
      }
    }
  }

  return Array.from(skillsById.values());
}

export function diffEquipmentSkills(
  beforeSnapshot: EquipmentSnapshot,
  afterSnapshot: EquipmentSnapshot,
): EquipmentSkillDiff {
  const before = getEquippedSkills(beforeSnapshot);
  const after = getEquippedSkills(afterSnapshot);
  const beforeById = indexSkillsById(before);
  const afterById = indexSkillsById(after);

  return {
    before,
    after,
    added: after
      .filter((skill) => !beforeById.has(skill.id))
      .map(cloneSkill),
    removed: before
      .filter((skill) => !afterById.has(skill.id))
      .map(cloneSkill),
  };
}
