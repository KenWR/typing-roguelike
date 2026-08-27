import {
  EQUIPMENT_CONFIGS,
  getEquipmentCarryCategory,
  type EquipmentConfig,
  type RunState,
  type SkillConfig,
} from "@typing-roguelike/shared";

export const getEquippedEquipment = (runState: Readonly<RunState>): readonly EquipmentConfig[] => {
  const ids = [
    runState.loadout.weaponId,
    runState.loadout.subweaponId,
    runState.loadout.ring1Id,
    runState.loadout.ring2Id,
  ].filter((id): id is string => id !== null);
  return ids.flatMap((id) => {
    const equipment = EQUIPMENT_CONFIGS.find((candidate) => candidate.id === id);
    return equipment === undefined ? [] : [equipment];
  });
};

export const getEquipmentHandLabel = (equipment: EquipmentConfig): string => {
  const category = getEquipmentCarryCategory(equipment);
  if (category === "two-handed-weapon") return "양손무기";
  if (category === "one-handed-weapon") return "한손무기";
  return "보조무기";
};

const getSkillDamageLabel = (skill: SkillConfig): string => {
  if (skill.damage !== undefined && skill.damage !== null && skill.damage.trim().length > 0) {
    return skill.damage;
  }
  const damageEffect = skill.effects?.find((effect) => effect.type === "damage");
  const coefficient =
    skill.damageCoefficient ?? (damageEffect?.type === "damage" ? damageEffect.coefficient : undefined);
  return coefficient === undefined ? "-" : `${Math.round(coefficient * 100)}%`;
};

const getSkillCategoryLabel = (skill: SkillConfig): string => (skill.category === "special" ? "특수기술" : "기본기술");

export const formatEquipmentSkillDetails = (equipment: EquipmentConfig): string =>
  equipment.skills
    .map(
      (skill) =>
        `${getSkillCategoryLabel(skill)} : ${skill.name}\ncommand: ${skill.command} · cost: ${skill.apCost} · damage: ${getSkillDamageLabel(skill)}\n${skill.description}`,
    )
    .join("\n\n");

export const formatEquipmentInfo = (equipment: EquipmentConfig): string =>
  `${equipment.name} · ${equipment.rarity} · ${getEquipmentHandLabel(equipment)}\n${formatEquipmentSkillDetails(equipment)}`;
