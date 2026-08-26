import type { EnemyActionConfig, EnemyConfig } from "./types.ts";

interface SpecialActionDefinition {
  id: string;
  name: string;
  damage: number;
  windupMs: number;
  recoveryMs: number;
  description: string;
  apDelta?: number;
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
  specialName?: string;
  specialDescription?: string;
  specialApDelta?: number;
  specials?: readonly SpecialActionDefinition[];
}

/**
 * 선딜 1초당 플레이어가 뽑아낼 수 있는 기준 피해량입니다.
 * AP 재생 1/초에 1 AP 기본기술의 평균 피해가 10 안팎이라는 전제로 잡았습니다.
 */
const PLAYER_DAMAGE_PER_WINDUP_SECOND = 10;

/** 선딜 동안 플레이어가 낼 수 있는 피해 중 실드가 흡수하는 비율입니다. */
const SHIELD_RATIO_BY_KIND: Record<EnemyActionConfig["kind"], number> = {
  attack: 0.4,
  special: 0.48,
  defense: 1,
};

const SHIELD_RATIO_BY_TIER: Record<EnemyConfig["tier"], number> = {
  normal: 1,
  summon: 1,
  elite: 1.3,
  boss: 1.6,
};

/**
 * 선딜이 시작될 때 채워지는 실드량입니다. 선딜이 길수록, 등급이 높을수록 두꺼워지며
 * 선딜 안에 플레이어가 실드를 모두 깎으면 그 행동은 취소됩니다.
 */
const createShieldAmount = (
  enemy: EnemyDefinition,
  kind: EnemyActionConfig["kind"],
  windupMs: number,
): number =>
  Math.ceil(
    (windupMs / 1000) *
      PLAYER_DAMAGE_PER_WINDUP_SECOND *
      SHIELD_RATIO_BY_KIND[kind] *
      SHIELD_RATIO_BY_TIER[enemy.tier],
  );

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
  windupMs: 3000,
  recoveryMs: 500,
  shieldAmount: createShieldAmount(enemy, "defense", 3000),
  description: "두꺼운 실드를 두르는 방어 자세",
  animation: createAnimationRefs(enemy.id, "defense"),
});

const createSpecialActions = (enemy: EnemyDefinition): readonly EnemyActionConfig[] => {
  const specials = enemy.specials ?? [{
    id: "special",
    name: enemy.specialName ?? `${enemy.name} 비기`,
    damage: Math.ceil(enemy.attackDamage * 1.5),
    windupMs: enemy.attackWindupMs + 1200,
    recoveryMs: 500,
    description: enemy.specialDescription ?? `${enemy.attackDescription} 강화 효과`,
    ...(enemy.specialApDelta === undefined ? {} : { apDelta: enemy.specialApDelta }),
  }];

  return specials.map((special) => ({
    id: `${enemy.id}-${special.id}`,
    kind: "special",
    name: special.name,
    damage: special.damage,
    windupMs: special.windupMs,
    recoveryMs: special.recoveryMs,
    ...(special.apDelta === undefined ? {} : { apDelta: special.apDelta }),
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
  actions: [createAttackAction(enemy), createDefenseAction(enemy), ...createSpecialActions(enemy)],
  reward: { weight: REWARD_WEIGHT_BY_TIER[enemy.tier] },
  assetKey: `enemy:${enemy.id}`,
});

export const ENEMY_CONFIGS = [
  createEnemyConfig({ id: "ink-slime", name: "먹물 슬라임", tier: "normal", role: "disruption", hp: 34, allowedFloors: [1, 2, 3], attackDamage: 7, attackWindupMs: 5400, attackDescription: "먹물을 뿜어 피해를 줍니다.", specialName: "먹물 압착", specialDescription: "플레이어 AP를 1 감소시킵니다.", specialApDelta: -1 }),
  createEnemyConfig({ id: "hook-tentacle", name: "갈고리 촉수", tier: "normal", role: "pressure", hp: 46, allowedFloors: [1, 2, 3, 4], attackDamage: 11, attackWindupMs: 4200, attackDescription: "갈고리로 후려쳐 피해를 줍니다.", specialName: "갈고리 휘감기", specialDescription: "플레이어 AP를 1 감소시킵니다.", specialApDelta: -1 }),
  createEnemyConfig({ id: "iron-beetle", name: "철갑 갑충", tier: "normal", role: "defense", hp: 72, allowedFloors: [2, 3, 4, 5], attackDamage: 13, attackWindupMs: 6000, attackDescription: "갑각을 열고 공격", specialName: "철갑 돌진" }),
  createEnemyConfig({ id: "bell-wraith", name: "종소리 망령", tier: "normal", role: "pressure", hp: 58, allowedFloors: [2, 3, 4, 5], attackDamage: 10, attackWindupMs: 5100, attackDescription: "추가 타격", specialName: "두 번째 울림" }),
  createEnemyConfig({ id: "mimic-doll", name: "모사 인형", tier: "normal", role: "pressure", hp: 64, allowedFloors: [3, 4, 5], attackDamage: 14, attackWindupMs: 5700, attackDescription: "마지막 공격 모사", specialName: "따라 하기" }),
  createEnemyConfig({ id: "reverse-bat", name: "역철자 박쥐", tier: "normal", role: "disruption", hp: 52, allowedFloors: [3, 4, 5, 6], attackDamage: 12, attackWindupMs: 4500, attackDescription: "다음 커맨드 역순", specialName: "역철자 울음" }),
  createEnemyConfig({ id: "space-eater", name: "공백 포식자", tier: "normal", role: "disruption", hp: 76, allowedFloors: [3, 4, 5, 6], attackDamage: 14, attackWindupMs: 6300, attackDescription: "장비 효과 봉인", specialName: "공백 포식" }),
  createEnemyConfig({ id: "needle-gunner", name: "바늘 사수", tier: "normal", role: "pressure", hp: 60, allowedFloors: [2, 3, 4, 5, 6, 7], attackDamage: 16, attackWindupMs: 3600, attackDescription: "긴 투사체", specialName: "바늘 연사" }),
  createEnemyConfig({ id: "red-scribe", name: "붉은 필경사", tier: "normal", role: "support", hp: 66, allowedFloors: [3, 4, 5, 6, 7, 8], attackDamage: 9, attackWindupMs: 6000, attackDescription: "아군 게이지 가속", specialName: "붉은 가속문" }),
  createEnemyConfig({ id: "repair-golem", name: "수복 골렘", tier: "normal", role: "support", hp: 108, allowedFloors: [5, 6, 7, 8], attackDamage: 15, attackWindupMs: 6600, attackDescription: "아군 회복", specialName: "수복 파동" }),
  createEnemyConfig({ id: "explosive-spore", name: "폭발 포자", tier: "normal", role: "execution", hp: 42, allowedFloors: [5, 6, 7, 8, 9], attackDamage: 22, attackWindupMs: 4200, attackDescription: "처치 후 폭발", specialName: "포자 폭쇄" }),
  createEnemyConfig({ id: "chain-executor", name: "사슬 집행자", tier: "normal", role: "defense", hp: 126, allowedFloors: [6, 7, 8, 9], attackDamage: 18, attackWindupMs: 5700, attackDescription: "대상 고정", specialName: "사슬 구속" }),
  createEnemyConfig({ id: "mirror-doll", name: "거울 인형", tier: "normal", role: "defense", hp: 88, allowedFloors: [6, 7, 8, 9], attackDamage: 17, attackWindupMs: 4800, attackDescription: "반사 자세", specialName: "거울 반사" }),
  createEnemyConfig({ id: "clock-tick", name: "초침 진드기", tier: "normal", role: "support", hp: 54, allowedFloors: [6, 7, 8, 9], attackDamage: 11, attackWindupMs: 4200, attackDescription: "아군 선딜 가속", specialName: "초침 가속" }),
  createEnemyConfig({ id: "ap-devourer", name: "행동력 포식자", tier: "normal", role: "execution", hp: 116, allowedFloors: [7, 8, 9], attackDamage: 20, attackWindupMs: 6900, attackDescription: "행동력을 갉아먹는 타격", specialName: "행동력 흡식", specialDescription: "플레이어 AP를 2 감소시킵니다.", specialApDelta: -2 }),
  createEnemyConfig({ id: "red-corrector", name: "붉은 교정관", tier: "elite", role: "disruption", hp: 185, allowedFloors: [4], attackDamage: 22, attackWindupMs: 4800, attackDescription: "교정 입력", specialName: "교정쇄" }),
  createEnemyConfig({ id: "inverted-knight", name: "뒤집힌 기사", tier: "elite", role: "defense", hp: 230, allowedFloors: [7], attackDamage: 26, attackWindupMs: 5400, attackDescription: "역순 입력", specialName: "역순 참격" }),
  createEnemyConfig({ id: "chorus-conductor", name: "합창의 지휘 촉수", tier: "elite", role: "support", hp: 260, allowedFloors: [8, 9], attackDamage: 16, attackWindupMs: 4500, attackDescription: "동기화 공격", specialName: "동기화 지휘" }),
  createEnemyConfig({ id: "palimpsest", name: "붉은 편집장 팔림프세스트", tier: "boss", role: "disruption", hp: 430, allowedFloors: [5], attackDamage: 30, attackWindupMs: 5700, attackDescription: "추가 어절 기믹", specials: [
    { id: "word-storm", name: "어절 폭풍", damage: 45, windupMs: 6900, recoveryMs: 700, description: "플레이어 AP를 1 감소시킵니다.", apDelta: -1 },
    { id: "red-edit", name: "붉은 교정", damage: 55, windupMs: 8100, recoveryMs: 900, description: "플레이어 AP를 1 감소시킵니다.", apDelta: -1 },
  ] }),
  createEnemyConfig({ id: "thousand-beat-chorus", name: "천 개의 박자 합창체", tier: "boss", role: "pressure", hp: 630, allowedFloors: [10], attackDamage: 20, attackWindupMs: 4500, attackDescription: "대합창은 최대 2회", specials: [
    { id: "grand-chorus", name: "대합창", damage: 30, windupMs: 5700, recoveryMs: 600, description: "합창의 압박으로 플레이어 AP를 1 감소시킵니다.", apDelta: -1 },
    { id: "crescendo", name: "크레센도", damage: 40, windupMs: 7200, recoveryMs: 800, description: "박자를 끌어올려 플레이어 AP를 1 감소시킵니다.", apDelta: -1 },
  ] }),
  createEnemyConfig({ id: "beat-tentacle", name: "박자 촉수", tier: "summon", role: "pressure", hp: 70, allowedFloors: [10], attackDamage: 11, attackWindupMs: 4200, attackDescription: "합창체 보조 공격", specialName: "박자 채찍" }),
] as const satisfies readonly EnemyConfig[];

export const ENEMY_BY_ID = new Map(ENEMY_CONFIGS.map((enemy) => [enemy.id, enemy]));
