import type { EnemyActionConfig, EnemyConfig } from "./types.ts";
import { ENEMY_ATTACK_WINDUP_MS, ENEMY_DEFAULT_SPECIAL_WINDUP_OFFSET_MS, ENEMY_DEFENSE_WINDUP_MS } from "./enemy-windup-values.ts";

interface SpecialActionDefinition { id: string; name: string; damage: number; windupMs: number; recoveryMs: number; description: string; }
interface EnemyDefinition { id: keyof typeof ENEMY_ATTACK_WINDUP_MS; name: string; tier: EnemyConfig["tier"]; role: EnemyConfig["role"]; hp: number; allowedFloors: readonly number[]; attackDamage: number; attackDescription: string; specialName?: string; specials?: readonly SpecialActionDefinition[]; }

const createAnimationRefs = (enemyId: string, actionId: string): EnemyActionConfig["animation"] => ({ windup: `enemy:${enemyId}:${actionId}:windup`, impact: `enemy:${enemyId}:${actionId}:impact`, recovery: `enemy:${enemyId}:idle` });
const createAttackAction = (enemy: EnemyDefinition): EnemyActionConfig => ({ id: `${enemy.id}-attack`, kind: "attack", name: "공격", damage: enemy.attackDamage, windupMs: ENEMY_ATTACK_WINDUP_MS[enemy.id], recoveryMs: 300, description: enemy.attackDescription, animation: createAnimationRefs(enemy.id, "attack") });
const createDefenseAction = (enemy: EnemyDefinition): EnemyActionConfig => ({ id: `${enemy.id}-defense`, kind: "defense", name: "방어", damage: 0, windupMs: ENEMY_DEFENSE_WINDUP_MS, recoveryMs: 500, defenseAmount: Math.ceil(enemy.attackDamage * 1.2), description: "피해를 감소시키는 방어 자세", animation: createAnimationRefs(enemy.id, "defense") });
const createSpecialActions = (enemy: EnemyDefinition): readonly EnemyActionConfig[] => {
  const specials = enemy.specials ?? [{ id: "special", name: enemy.specialName ?? `${enemy.name} 비기`, damage: Math.ceil(enemy.attackDamage * 1.5), windupMs: ENEMY_ATTACK_WINDUP_MS[enemy.id] + ENEMY_DEFAULT_SPECIAL_WINDUP_OFFSET_MS, recoveryMs: 500, description: `${enemy.attackDescription} 강화 효과` }];
  return specials.map((special) => ({ id: `${enemy.id}-${special.id}`, kind: "special", name: special.name, damage: special.damage, windupMs: special.windupMs, recoveryMs: special.recoveryMs, description: special.description, animation: createAnimationRefs(enemy.id, special.id) }));
};
const REWARD_WEIGHT_BY_TIER: Record<EnemyConfig["tier"], number> = { normal: 1, elite: 3, boss: 8, summon: 0 };
const createEnemyConfig = (enemy: EnemyDefinition): EnemyConfig => ({ id: enemy.id, name: enemy.name, tier: enemy.tier, role: enemy.role, hp: enemy.hp, allowedFloors: enemy.allowedFloors, actions: [createAttackAction(enemy), createDefenseAction(enemy), ...createSpecialActions(enemy)], reward: { weight: REWARD_WEIGHT_BY_TIER[enemy.tier] }, assetKey: `enemy:${enemy.id}` });

export const ENEMY_CONFIGS = [
  createEnemyConfig({ id: "ink-slime", name: "먹물 슬라임", tier: "normal", role: "disruption", hp: 34, allowedFloors: [1,2,3], attackDamage: 7, attackDescription: "다음 입력 제한시간 20% 감소", specialName: "먹물 압착" }),
  createEnemyConfig({ id: "hook-tentacle", name: "갈고리 촉수", tier: "normal", role: "pressure", hp: 46, allowedFloors: [1,2,3,4], attackDamage: 11, attackDescription: "다음 플레이어 후딜 200ms 증가", specialName: "갈고리 휘감기" }),
  createEnemyConfig({ id: "iron-beetle", name: "철갑 갑충", tier: "normal", role: "defense", hp: 72, allowedFloors: [2,3,4,5], attackDamage: 13, attackDescription: "갑각을 열고 공격", specialName: "철갑 돌진" }),
  createEnemyConfig({ id: "bell-wraith", name: "종소리 망령", tier: "normal", role: "pressure", hp: 58, allowedFloors: [2,3,4,5], attackDamage: 10, attackDescription: "추가 타격", specialName: "두 번째 울림" }),
  createEnemyConfig({ id: "mimic-doll", name: "모사 인형", tier: "normal", role: "pressure", hp: 64, allowedFloors: [3,4,5], attackDamage: 14, attackDescription: "마지막 공격 모사", specialName: "따라 하기" }),
  createEnemyConfig({ id: "reverse-bat", name: "역철자 박쥐", tier: "normal", role: "disruption", hp: 52, allowedFloors: [3,4,5,6], attackDamage: 12, attackDescription: "다음 커맨드 역순", specialName: "역철자 울음" }),
  createEnemyConfig({ id: "space-eater", name: "공백 포식자", tier: "normal", role: "disruption", hp: 76, allowedFloors: [3,4,5,6], attackDamage: 14, attackDescription: "장비 효과 봉인", specialName: "공백 포식" }),
  createEnemyConfig({ id: "needle-gunner", name: "바늘 사수", tier: "normal", role: "pressure", hp: 60, allowedFloors: [2,3,4,5,6,7], attackDamage: 16, attackDescription: "긴 투사체", specialName: "바늘 연사" }),
  createEnemyConfig({ id: "red-scribe", name: "붉은 필경사", tier: "normal", role: "support", hp: 66, allowedFloors: [3,4,5,6,7,8], attackDamage: 9, attackDescription: "아군 게이지 가속", specialName: "붉은 가속문" }),
  createEnemyConfig({ id: "repair-golem", name: "수복 골렘", tier: "normal", role: "support", hp: 108, allowedFloors: [5,6,7,8], attackDamage: 15, attackDescription: "아군 회복", specialName: "수복 파동" }),
  createEnemyConfig({ id: "explosive-spore", name: "폭발 포자", tier: "normal", role: "execution", hp: 42, allowedFloors: [5,6,7,8,9], attackDamage: 22, attackDescription: "처치 후 폭발", specialName: "포자 폭쇄" }),
  createEnemyConfig({ id: "chain-executor", name: "사슬 집행자", tier: "normal", role: "defense", hp: 126, allowedFloors: [6,7,8,9], attackDamage: 18, attackDescription: "대상 고정", specialName: "사슬 구속" }),
  createEnemyConfig({ id: "mirror-doll", name: "거울 인형", tier: "normal", role: "defense", hp: 88, allowedFloors: [6,7,8,9], attackDamage: 17, attackDescription: "반사 자세", specialName: "거울 반사" }),
  createEnemyConfig({ id: "clock-tick", name: "초침 진드기", tier: "normal", role: "support", hp: 54, allowedFloors: [6,7,8,9], attackDamage: 11, attackDescription: "아군 선딜 가속", specialName: "초침 가속" }),
  createEnemyConfig({ id: "ap-devourer", name: "행동력 포식자", tier: "normal", role: "execution", hp: 116, allowedFloors: [7,8,9], attackDamage: 20, attackDescription: "AP 1 감소", specialName: "행동력 흡식" }),
  createEnemyConfig({ id: "red-corrector", name: "붉은 교정관", tier: "elite", role: "disruption", hp: 185, allowedFloors: [4], attackDamage: 22, attackDescription: "교정 입력", specialName: "교정쇄" }),
  createEnemyConfig({ id: "inverted-knight", name: "뒤집힌 기사", tier: "elite", role: "defense", hp: 230, allowedFloors: [7], attackDamage: 26, attackDescription: "역순 입력", specialName: "역순 참격" }),
  createEnemyConfig({ id: "chorus-conductor", name: "합창의 지휘 촉수", tier: "elite", role: "support", hp: 260, allowedFloors: [8,9], attackDamage: 16, attackDescription: "동기화 공격", specialName: "동기화 지휘" }),
  createEnemyConfig({ id: "palimpsest", name: "붉은 편집장 팔림프세스트", tier: "boss", role: "disruption", hp: 430, allowedFloors: [5], attackDamage: 30, attackDescription: "추가 어절 기믹", specials: [
    { id: "word-storm", name: "어절 폭풍", damage: 45, windupMs: 9200, recoveryMs: 700, description: "추가 어절을 생성합니다." },
    { id: "red-edit", name: "붉은 교정", damage: 55, windupMs: 10800, recoveryMs: 900, description: "플레이어의 입력 규칙을 교정합니다." },
  ] }),
  createEnemyConfig({ id: "thousand-beat-chorus", name: "천 개의 박자 합창체", tier: "boss", role: "pressure", hp: 630, allowedFloors: [10], attackDamage: 20, attackDescription: "대합창은 최대 2회", specials: [
    { id: "grand-chorus", name: "대합창", damage: 30, windupMs: 7600, recoveryMs: 600, description: "대합창을 시작합니다." },
    { id: "crescendo", name: "크레센도", damage: 40, windupMs: 9600, recoveryMs: 800, description: "합창의 박자를 끌어올립니다." },
  ] }),
  createEnemyConfig({ id: "beat-tentacle", name: "박자 촉수", tier: "summon", role: "pressure", hp: 70, allowedFloors: [10], attackDamage: 11, attackDescription: "합창체 보조 공격", specialName: "박자 채찍" }),
] as const satisfies readonly EnemyConfig[];

export const ENEMY_BY_ID = new Map(ENEMY_CONFIGS.map((enemy) => [enemy.id, enemy]));
