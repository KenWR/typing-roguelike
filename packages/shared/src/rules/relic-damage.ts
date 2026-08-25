import { RELIC_CONFIGS } from "../content/relics.ts";
import type { RelicDamageModifier, RelicDamagePriority, SkillCategory } from "../content/types.ts";

export interface DamageCalculationInput {
  weaponAttack: number;
  skillCoefficient: number;
  skillCategory: SkillCategory;
  ownedRelicIds: ReadonlySet<string>;
  targetHpRatio?: number;
  enemyCount?: number;
  inputDurationMs?: number;
  targetGuarding?: boolean;
  enemyWindingUp?: boolean;
  playerHpRatio?: number;
  hasTwoHandedWeapon?: boolean;
  recoveryMs?: number;
  hasRepeatedCharacter?: boolean;
  floor?: number;
}

export interface DamageCalculationResult {
  damage: number;
  baseDamage: number;
  categoryBonus: number;
  conditionalBonus: number;
  finalBonus: number;
  appliedRelicIds: readonly string[];
}

const relicIdByName = new Map(RELIC_CONFIGS.map((relic) => [relic.name, relic.id]));
const relicId = (name: string): string => {
  const id = relicIdByName.get(name);
  if (id === undefined) throw new Error(`Missing relic config: ${name}`);
  return id;
};

/** 피해에 직접 관여하는 유물만 선언합니다. AP·회복·방어 효과는 별도 계산기에서 처리합니다. */
export const RELIC_DAMAGE_MODIFIERS: ReadonlyMap<string, readonly RelicDamageModifier[]> = new Map([
  [relicId("붉은 잉크병"), [{ priority: "final", multiplier: 0.1 }]],
  [relicId("잔향의 모래시계"), [{ priority: "conditional", multiplier: 0.25, condition: "recoveryLong" }]],
  [relicId("연속의 활자"), [{ priority: "conditional", multiplier: 0.4 }]],
  [relicId("천 개의 박자"), [{ priority: "conditional", multiplier: 0.25, condition: "enemyCountThree" }]],
  [relicId("검집"), [{ priority: "conditional", multiplier: 0.35 }]],
  [relicId("숫돌"), [{ priority: "category", multiplier: 0.2 }]],
  [relicId("광전사의 장갑"), [{ priority: "category", multiplier: 0.35 }]],
  [relicId("오거의 피"), [{ priority: "conditional", multiplier: 0.18, condition: "twoHandedWeapon" }]],
  [relicId("초승달 검"), [{ priority: "conditional", multiplier: 0.35, condition: "targetHpHalf" }]],
  [relicId("둔중한 대검"), [{ priority: "category", multiplier: 0.45 }]],
  [relicId("방패 부수개"), [{ priority: "conditional", multiplier: 0.6, condition: "targetGuarding" }]],
  [relicId("바람 베기"), [{ priority: "conditional", multiplier: 0.3, condition: "fastInput" }]],
  [relicId("화염 주문서"), [{ priority: "category", multiplier: 0.18 }]],
  [relicId("번개 주문서"), [{ priority: "conditional", multiplier: 0.45, condition: "fastInput" }]],
  [relicId("고장 난 키보드"), [{ priority: "conditional", multiplier: 0.4, condition: "repeatedCharacter" }]],
  [relicId("도박사의 주사위"), [{ priority: "category", multiplier: 0.15, skillCategories: ["basic"] }, { priority: "category", multiplier: -0.15, skillCategories: ["special"] }]],
  [relicId("사냥꾼의 망토"), [{ priority: "conditional", multiplier: 0.25, condition: "enemyWindingUp" }]],
  [relicId("결투가의 훈장"), [{ priority: "conditional", multiplier: 0.6, condition: "bothHpLow" }]],
  [relicId("탑의 계약서"), [{ priority: "conditional", multiplier: 0.05, condition: "floor" }]],
]);

/** 계산 중 소유 유물 전체를 순회하지 않도록, 기술 분류별 후보 유물 ID를 미리 색인합니다. */
export const DAMAGE_RELIC_IDS_BY_CATEGORY: Readonly<Record<SkillCategory, readonly string[]>> = Object.freeze({
  basic: RELIC_CONFIGS.filter((relic) => relic.skillTags.includes("basic") && RELIC_DAMAGE_MODIFIERS.has(relic.id)).map((relic) => relic.id),
  special: RELIC_CONFIGS.filter((relic) => relic.skillTags.includes("special") && RELIC_DAMAGE_MODIFIERS.has(relic.id)).map((relic) => relic.id),
  guard: RELIC_CONFIGS.filter((relic) => relic.skillTags.includes("guard") && RELIC_DAMAGE_MODIFIERS.has(relic.id)).map((relic) => relic.id),
});

const isConditionMet = (condition: RelicDamageModifier["condition"], input: DamageCalculationInput): boolean => {
  switch (condition) {
    case undefined: return true;
    case "targetHpHalf": return (input.targetHpRatio ?? 1) <= 0.5;
    case "enemyCountThree": return (input.enemyCount ?? 0) >= 3;
    case "fastInput": return (input.inputDurationMs ?? Infinity) <= 500;
    case "targetGuarding": return input.targetGuarding === true;
    case "enemyWindingUp": return input.enemyWindingUp === true;
    case "bothHpLow": return (input.targetHpRatio ?? 1) <= 0.3 && (input.playerHpRatio ?? 1) <= 0.3;
    case "twoHandedWeapon": return input.hasTwoHandedWeapon === true;
    case "recoveryLong": return (input.recoveryMs ?? 0) >= 600;
    case "repeatedCharacter": return input.hasRepeatedCharacter === true;
    case "floor": return (input.floor ?? 0) > 0;
  }
};

export const calculateRelicDamage = (input: DamageCalculationInput): DamageCalculationResult => {
  const bonuses: Record<RelicDamagePriority, number> = { category: 0, conditional: 0, final: 0 };
  const appliedRelicIds: string[] = [];
  for (const relicId of DAMAGE_RELIC_IDS_BY_CATEGORY[input.skillCategory]) {
    if (!input.ownedRelicIds.has(relicId)) continue;
    for (const modifier of RELIC_DAMAGE_MODIFIERS.get(relicId) ?? []) {
      if (modifier.skillCategories !== undefined && !modifier.skillCategories.includes(input.skillCategory)) continue;
      if (!isConditionMet(modifier.condition, input)) continue;
      bonuses[modifier.priority] += modifier.condition === "floor" ? modifier.multiplier * (input.floor ?? 0) : modifier.multiplier;
      appliedRelicIds.push(relicId);
    }
  }
  const baseDamage = input.weaponAttack * input.skillCoefficient;
  const damage = Math.max(1, Math.round(baseDamage * (1 + bonuses.category) * (1 + bonuses.conditional) * (1 + bonuses.final)));
  return { damage, baseDamage, categoryBonus: bonuses.category, conditionalBonus: bonuses.conditional, finalBonus: bonuses.final, appliedRelicIds };
};
