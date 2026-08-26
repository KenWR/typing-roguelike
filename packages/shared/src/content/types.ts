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
  /** 성공적으로 적중했을 때 플레이어 AP에 적용할 변화량. */
  apDeltaOnHit?: number;
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
export type EnemyTier = "normal" | "elite" | "boss" | "summon";
export type EnemyRole = "pressure" | "defense" | "support" | "disruption" | "execution";
export type EnemyActionKind = "attack" | "defense" | "special";
export interface EnemyAnimationRefs {
  /** 공격 준비 구간에 재생할 애니메이션/모션 키 */
  windup: string;
  /** 실제 타격 시점에 재생할 애니메이션/모션 키 */
  impact?: string;
  /** 후딜 또는 기본 상태 복귀에 사용할 애니메이션/모션 키 */
  recovery?: string;
}
export interface EnemyRewardConfig {
  /** 처치 시 보상 선택/드롭 계산에 사용할 가중치 */
  weight: number;
  /** 콘텐츠 확장 시 사용할 최소 보상 등급 */
  minimumRarity?: Rarity;
}
export interface EnemyActionConfig {
  id: string;
  kind: EnemyActionKind;
  name: string;
  damage: number;
  windupMs: number;
  recoveryMs: number;
  defenseAmount?: number;
  /** 적 행동이 적중했을 때 플레이어 AP에 적용할 변화량. */
  apDelta?: number;
  description: string;
  animation: EnemyAnimationRefs;
}
export interface EnemyConfig {
  id: string;
  name: string;
  tier: EnemyTier;
  role: EnemyRole;
  hp: number;
  allowedFloors: readonly number[];
  actions: readonly EnemyActionConfig[];
  reward: EnemyRewardConfig;
  assetKey: string;
}
export interface EncounterConfig { id: string; floor: number; nodeType: "combat" | "elite" | "boss"; weight: number; members: readonly { enemyId: string; count: number }[]; }
