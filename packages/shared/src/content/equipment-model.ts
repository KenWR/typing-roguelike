import { EQUIPMENT_CONFIGS } from "./equipment.ts";
import type { EquipmentConfig, SkillConfig } from "./types.ts";

export type EquipmentSkillLinks = Readonly<{
  /** 일반 입력으로 제공되는 기본/방어 계열 스킬 ID */
  basic: readonly string[];
  /** 장비의 고유 선택지를 만드는 특수 스킬 ID */
  signature: readonly string[];
}>;

export type EquipmentDataModel = Readonly<{
  id: string;
  name: string;
  slot: EquipmentConfig["slot"];
  kind: EquipmentConfig["kind"];
  rarity: EquipmentConfig["rarity"];
  sellValue: number;
  baseAttack?: number;
  /** 렌더러/에셋 레지스트리에서 사용할 안정적인 장비 에셋 키 */
  assetKey: string;
  skills: readonly SkillConfig[];
  skillLinks: EquipmentSkillLinks;
}>;

const cloneSkill = (skill: SkillConfig): SkillConfig => ({
  ...skill,
  tags: skill.tags ? [...skill.tags] : undefined,
});

const createSkillLinks = (
  skills: readonly SkillConfig[],
): EquipmentSkillLinks => ({
  basic: skills
    .filter((skill) => skill.category === "basic" || skill.category === "guard")
    .map((skill) => skill.id),
  signature: skills
    .filter((skill) => skill.category === "special")
    .map((skill) => skill.id),
});

export const createEquipmentDataModel = (
  equipment: EquipmentConfig,
): EquipmentDataModel => {
  const skills = equipment.skills.map(cloneSkill);

  return {
    id: equipment.id,
    name: equipment.name,
    slot: equipment.slot,
    kind: equipment.kind,
    rarity: equipment.rarity,
    sellValue: equipment.sellValue,
    ...(equipment.baseAttack === undefined
      ? {}
      : { baseAttack: equipment.baseAttack }),
    assetKey: `equipment:${equipment.id}`,
    skills,
    skillLinks: createSkillLinks(skills),
  };
};

export const EQUIPMENT_DATA_MODELS = EQUIPMENT_CONFIGS.map(
  createEquipmentDataModel,
) as readonly EquipmentDataModel[];

export const EQUIPMENT_DATA_BY_ID = new Map(
  EQUIPMENT_DATA_MODELS.map((equipment) => [equipment.id, equipment]),
);

export const getEquipmentDataModel = (
  equipmentId: string,
): EquipmentDataModel | undefined => EQUIPMENT_DATA_BY_ID.get(equipmentId);

export const getEquipmentSkill = (
  equipment: EquipmentDataModel,
  skillId: string,
): SkillConfig | undefined => equipment.skills.find((skill) => skill.id === skillId);
