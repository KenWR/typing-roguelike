export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "hidden";
export type SkillCategory = "basic" | "special" | "guard";
export type EquipmentKind = "sword" | "greatsword" | "wand" | "staff" | "bow" | "crossbow" | "mace" | "club" | "shield" | "tome" | "orb" | "quiver";
export interface SkillConfig {
  id: string;
  type?: "basic" | "special";
  name: string;
  command: string;
  kind: "attack" | "defense" | "utility";
  category: SkillCategory;
  apCost: number;
  windupMs: number;
  recoveryMs: number;
  damageCoefficient?: number;
  damage?: string | null;
  description: string;
  tags?: readonly string[];
  effect?: string;
}
export interface EquipmentConfig { id: string; name: string; slot: "weapon" | "subweapon"; kind: EquipmentKind; rarity: Rarity; sellValue: number; baseAttack?: number; skills: readonly SkillConfig[]; }
export interface RelicConfig { id: string; name: string; rarity: Rarity; description: string; maxStacks: number; skillTags: readonly SkillCategory[]; effects: readonly string[]; }
export type RelicDamagePriority = "category" | "conditional" | "final";
export interface RelicDamageModifier {
  priority: RelicDamagePriority;
  /** 같은 우선순위의 값은 합산하고, 우선순위 단계끼리는 곱연산합니다. */
  multiplier: number;
  skillCategories?: readonly SkillCategory[];
  condition?: "targetHpHalf" | "enemyCountThree" | "fastInput" | "targetGuarding" | "enemyWindingUp" | "bothHpLow" | "twoHandedWeapon" | "recoveryLong" | "repeatedCharacter" | "floor";
}
export type EnemyActionKind = "attack" | "defense" | "special";
export interface EnemyActionConfig {
  id: string;
  kind: EnemyActionKind;
  name: string;
  damage: number;
  windupMs: number;
  recoveryMs: number;
  defenseAmount?: number;
  description: string;
}
export interface EnemyConfig { id: string; name: string; tier: "normal" | "elite" | "boss" | "summon"; role: "pressure" | "defense" | "support" | "disruption" | "execution"; hp: number; allowedFloors: readonly number[]; actions: readonly EnemyActionConfig[]; }
export interface EncounterConfig { id: string; floor: number; nodeType: "combat" | "elite" | "boss"; weight: number; members: readonly { enemyId: string; count: number }[]; }
