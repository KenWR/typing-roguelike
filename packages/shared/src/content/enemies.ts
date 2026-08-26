import type { EnemyActionConfig, EnemyConfig } from "./types.ts";

interface SpecialActionDefinition {
  id: string;
  damage: number;
  windupMs: number;
  recoveryMs: number;
  description: string;
}

interface EnemyDefinition {
  id: string;
  name: string;
  tier: EnemyConfig["tier"];
  role: EnemyConfig["role"];
  hp: number;
  allowedFloors: readonly number[];
  attackDamage: number;
  attackWindupMs: number;
  attackDescription: string;
  specials?: readonly SpecialActionDefinition[];
}

const createAnimationRefs = (enemyId: string, actionId: string): EnemyActionConfig["animation"] => ({
  windup: `enemy:${enemyId}:${actionId}:windup`,
  impact: `enemy:${enemyId}:${actionId}:impact`,
  recovery: `enemy:${enemyId}:idle`,
});

const createAttackAction = (enemy: EnemyDefinition): EnemyActionConfig => ({
  id: `${enemy.id}-attack`,
  kind: "attack",
  name: "공격",
  damage: enemy.attackDamage,
  windupMs: enemy.attackWindupMs,
  recoveryMs: 300,
  description: enemy.attackDescription,
  animation: createAnimationRefs(enemy.id, "attack"),
});

const createDefenseAction = (enemy: EnemyDefinition): EnemyActionConfig => ({
  id: `${enemy.id}-defense`,
  kind: "defense",
  name: "방어",
  damage: 0,
  windupMs: 1000,
  recoveryMs: 500,
  defenseAmount: Math.ceil(enemy.attackDamage * 1.2),
  description: "피해를 감소시키는 방어 자세",
  animation: createAnimationRefs(enemy.id, "defense"),
});

const createSpecialActions = (enemy: EnemyDefinition): readonly EnemyActionConfig[] => {
  const specials = enemy.specials ?? [{
    id: "special",
    damage: Math.ceil(enemy.attackDamage * 1.5),
    windupMs: enemy.attackWindupMs + 400,
    recoveryMs: 500,
    description: `${enemy.attackDescription} 강화 효과`,
  }];

  return specials.map((special) => ({
    id: `${enemy.id}-${special.id}`,
    kind: "special",
    name: "특수기술",
    damage: special.damage,
    windupMs: special.windupMs,
    recoveryMs: special.recoveryMs,
    description: special.description,
    animation: createAnimationRefs(enemy.id, special.id),
  }));
};

const REWARD_WEIGHT_BY_TIER: Record<EnemyConfig["tier"], number> = {
  normal: 1,
  elite: 3,
  boss: 8,
  summon: 0,
};

const createEnemyConfig = (enemy: EnemyDefinition): EnemyConfig => ({
  id: enemy.id,
  name: enemy.name,
  tier: enemy.tier,
  role: enemy.role,
  hp: enemy.hp,
  allowedFloors: enemy.allowedFloors,
  actions: [
    createAttackAction(enemy),
    createDefenseAction(enemy),
    ...createSpecialActions(enemy),
  ],
  reward: {
    weight: REWARD_WEIGHT_BY_TIER[enemy.tier],
  },
  assetKey: `enemy:${enemy.id}`,
});

export const ENEMY_CONFIGS = [
  createEnemyConfig({ id: "ink-slime", name: "먹물 슬라임", tier: "normal", role: "disruption", hp: 34, allowedFloors: [1, 2, 3], attackDamage: 7, attackWindupMs: 1800, attackDescription: "다음 입력 제한시간 20% 감소" }),
  createEnemyConfig({ id: "hook-tentacle", name: "갈고리 촉수", tier: "normal", role: "pressure", hp: 46, allowedFloors: [1, 2, 3, 4], attackDamage: 11, attackWindupMs: 1400, attackDescription: "다음 플레이어 후딜 200ms 증가" }),
  createEnemyConfig({ id: "iron-beetle", name: "철갑 갑충", tier: "normal", role: "defense", hp: 72, allowedFloors: [2, 3, 4, 5], attackDamage: 13, attackWindupMs: 2000, attackDescription: "갑각을 열고 공격" }),
  createEnemyConfig({ id: "bell-wraith", name: "종소리 망령", tier: "normal", role: "pressure", hp: 58, allowedFloors: [2, 3, 4, 5], attackDamage: 10, attackWindupMs: 1700, attackDescription: "추가 타격" }),
  createEnemyConfig({ id: "mimic-doll", name: "모사 인형", tier: "normal", role: "pressure", hp: 64, allowedFloors: [3, 4, 5], attackDamage: 14, attackWindupMs: 1900, attackDescription: "마지막 공격 모사" }),
  createEnemyConfig({ id: "reverse-bat", name: "역철자 박쥐", tier: "normal", role: "disruption", hp: 52, allowedFloors: [3, 4, 5, 6], attackDamage: 12, attackWindupMs: 1500, attackDescription: "다음 커맨드 역순" }),
  createEnemyConfig({ id: "space-eater", name: "공백 포식자", tier: "normal", role: "disruption", hp: 76, allowedFloors: [3, 4, 5, 6], attackDamage: 14, attackWindupMs: 2100, attackDescription: "장비 효과 봉인" }),
  createEnemyConfig({ id: "needle-gunner", name: "바늘 사수", tier: "normal", role: "pressure", hp: 60, allowedFloors: [2, 3, 4, 5, 6, 7], attackDamage: 16, attackWindupMs: 1200, attackDescription: "긴 투사체" }),
  createEnemyConfig({ id: "red-scribe", name: "붉은 필경사", tier: "normal", role: "support", hp: 66, allowedFloors: [3, 4, 5, 6, 7, 8], attackDamage: 9, attackWindupMs: 2000, attackDescription: "아군 게이지 가속" }),
  createEnemyConfig({ id: "repair-golem", name: "수복 골렘", tier: "normal", role: "support", hp: 108, allowedFloors: [5, 6, 7, 8], attackDamage: 15, attackWindupMs: 2200, attackDescription: "아군 회복" }),
  createEnemyConfig({ id: "explosive-spore", name: "폭발 포자", tier: "normal", role: "execution", hp: 42, allowedFloors: [5, 6, 7, 8, 9], attackDamage: 22, attackWindupMs: 1400, attackDescription: "처치 후 폭발" }),
  createEnemyConfig({ id: "chain-executor", name: "사슬 집행자", tier: "normal", role: "defense", hp: 126, allowedFloors: [6, 7, 8, 9], attackDamage: 18, attackWindupMs: 1900, attackDescription: "대상 고정" }),
  createEnemyConfig({ id: "mirror-doll", name: "거울 인형", tier: "normal", role: "defense", hp: 88, allowedFloors: [6, 7, 8, 9], attackDamage: 17, attackWindupMs: 1600, attackDescription: "반사 자세" }),
  createEnemyConfig({ id: "clock-tick", name: "초침 진드기", tier: "normal", role: "support", hp: 54, allowedFloors: [6, 7, 8, 9], attackDamage: 11, attackWindupMs: 1400, attackDescription: "아군 선딜 가속" }),
  createEnemyConfig({ id: "ap-devourer", name: "행동력 포식자", tier: "normal", role: "execution", hp: 116, allowedFloors: [7, 8, 9], attackDamage: 20, attackWindupMs: 2300, attackDescription: "AP 1 감소" }),
  createEnemyConfig({ id: "red-corrector", name: "붉은 교정관", tier: "elite", role: "disruption", hp: 185, allowedFloors: [4], attackDamage: 22, attackWindupMs: 1600, attackDescription: "교정 입력" }),
  createEnemyConfig({ id: "inverted-knight", name: "뒤집힌 기사", tier: "elite", role: "defense", hp: 230, allowedFloors: [7], attackDamage: 26, attackWindupMs: 1800, attackDescription: "역순 입력" }),
  createEnemyConfig({ id: "chorus-conductor", name: "합창의 지휘 촉수", tier: "elite", role: "support", hp: 260, allowedFloors: [8, 9], attackDamage: 16, attackWindupMs: 1500, attackDescription: "동기화 공격" }),
  createEnemyConfig({ id: "palimpsest", name: "붉은 편집장 팔림프세스트", tier: "boss", role: "disruption", hp: 430, allowedFloors: [5], attackDamage: 30, attackWindupMs: 1900, attackDescription: "추가 어절 기믹", specials: [
    { id: "word-storm", damage: 45, windupMs: 2300, recoveryMs: 700, description: "추가 어절을 생성합니다." },
    { id: "red-edit", damage: 55, windupMs: 2700, recoveryMs: 900, description: "플레이어의 입력 규칙을 교정합니다." },
  ] }),
  createEnemyConfig({ id: "thousand-beat-chorus", name: "천 개의 박자 합창체", tier: "boss", role: "pressure", hp: 630, allowedFloors: [10], attackDamage: 20, attackWindupMs: 1500, attackDescription: "대합창은 최대 2회", specials: [
    { id: "grand-chorus", damage: 30, windupMs: 1900, recoveryMs: 600, description: "대합창을 시작합니다." },
    { id: "crescendo", damage: 40, windupMs: 2400, recoveryMs: 800, description: "합창의 박자를 끌어올립니다." },
  ] }),
  createEnemyConfig({ id: "beat-tentacle", name: "박자 촉수", tier: "summon", role: "pressure", hp: 70, allowedFloors: [10], attackDamage: 11, attackWindupMs: 1400, attackDescription: "합창체 보조 공격" }),
] as const satisfies readonly EnemyConfig[];

export const ENEMY_BY_ID = new Map(ENEMY_CONFIGS.map((enemy) => [enemy.id, enemy]));
