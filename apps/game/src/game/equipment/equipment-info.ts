import { EQUIPMENT_CONFIGS, type EquipmentConfig, type RunState } from "@typing-roguelike/shared";

export const getEquippedEquipment = (runState: Readonly<RunState>): readonly EquipmentConfig[] => {
  const ids = [runState.loadout.weaponId, runState.loadout.subweaponId, runState.loadout.ring1Id, runState.loadout.ring2Id].filter(
    (id): id is string => id !== null,
  );
  return ids.flatMap((id) => {
    const equipment = EQUIPMENT_CONFIGS.find((candidate) => candidate.id === id);
    return equipment === undefined ? [] : [equipment];
  });
};

export const formatEquipmentInfo = (equipment: EquipmentConfig): string => {
  const skills = equipment.skills.map((skill) => `${skill.name} · ${skill.command}\n${skill.description}`).join("\n\n");
  return `${equipment.name} · ${equipment.rarity}\n${skills}`;
};
