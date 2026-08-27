export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "hidden";
export type SkillCategory = "basic" | "special" | "guard";
export type SkillEffectConfig =
  | Readonly<{ type: "damage"; coefficient: number }>
  | Readonly<{
      type: "shield";
      amount: number;
      durationMs: number;
    }>
  | Readonly<{
      type: "status";
      statusId: string;
      durationMs: number;
      stacks?: number;
    }>;
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
  effects?: readonly SkillEffectConfig[];
  /** 성공적으로 적중했을 때 플레이어 AP에 적용할 변화량. */
  apDeltaOnHit?: number;
}
export interface EquipmentConfig { id: string; name: string; slot: "weapon" | "subweapon"; kind: EquipmentKind; rarity: Rarity; sellValue: number; baseAttack?: number; skills: readonly SkillConfig[]; }
export interface RelicConfig { id: string; name: string; rarity: Rarity; description: string; maxStacks: number; skillTags: readonly SkillCategory[]; effects: readonly string[]; }

/** 반지의 문자열이 기본 커맨드 앞/뒤 중 어디에 붙는지 결정한다. 장착 슬롯 번호와 무관하다. */
export type RingPosition = "prefix" | "suffix";

export type RingSkillModifier = Readonly<{
  /** 지정하지 않으면 모든 스킬 카테고리에 적용한다. */
  skillCategories?: readonly SkillCategory[];
  /** AP 비용에 더한다. 음수도 허용하며 최종 비용은 0 미만이 되지 않는다. */
  apCostDelta?: number;
  /** 선딜에 곱한다. */
  windupMultiplier?: number;
  /** 피해 계수에 곱한다. 장착 반지 전체의 최종 피해 증폭은 +100%에서 제한한다. */
  damageMultiplier?: number;
  /** 적중 시 추가하는 상태 효과. */
  onHitStatus?: Readonly<{
    statusId: string;
    durationMs: number;
    stacks?: number;
  }>;
}>;

export interface RingConfig {
  id: string;
  name: string;
  position: RingPosition;
  /** 커맨드 앞/뒤에 실제로 붙는 문자열. 예: `신속한`, `연속으로`. */
  commandAffix: string;
  rarity: Rarity;
  sellValue: number;
  description: string;
  modifiers: readonly RingSkillModifier[];
}

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
  /**
   * 선딜이 시작되는 순간 이 적에게 채워지는 실드량입니다.
   * 선딜이 끝나면 남은 양과 함께 사라지고, 선딜 중에 모두 깎이면 행동이 취소됩니다.
   */
  shieldAmount?: number;
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
