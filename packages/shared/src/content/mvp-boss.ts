import { ENEMY_BY_ID } from "./enemies.ts";
import type { EnemyConfig } from "./types.ts";

export type MvpBossFailureMode = Readonly<{
  cause: string;
  response: string;
}>;

export type MvpBossAlternative = Readonly<{
  enemyId: string;
  excludedReason: string;
}>;

export type MvpBossSpec = Readonly<{
  enemy: EnemyConfig;
  learnedFromEliteId: string;
  learnedMechanic: string;
  signatureActionIds: readonly string[];
  selectionReason: string;
  failureModes: readonly MvpBossFailureMode[];
  alternatives: readonly MvpBossAlternative[];
  requiredAnimations: readonly string[];
}>;

const requireEnemy = (
  enemyId: string,
  tier: EnemyConfig["tier"],
): EnemyConfig => {
  const enemy = ENEMY_BY_ID.get(enemyId);
  if (enemy === undefined) {
    throw new Error(`Unknown enemy id: ${enemyId}`);
  }
  if (enemy.tier !== tier) {
    throw new Error(`Expected ${tier} enemy: ${enemyId}`);
  }
  return enemy;
};

const collectRequiredAnimations = (enemy: EnemyConfig): readonly string[] => {
  const keys = new Set<string>();

  for (const action of enemy.actions) {
    keys.add(action.animation.windup);
    if (action.animation.impact !== undefined) {
      keys.add(action.animation.impact);
    }
    if (action.animation.recovery !== undefined) {
      keys.add(action.animation.recovery);
    }
  }

  return [...keys];
};

const boss = requireEnemy("palimpsest", "boss");
const learnedFromElite = requireEnemy("red-corrector", "elite");
const signatureActionIds = boss.actions
  .filter((action) => action.kind === "special")
  .map((action) => action.id);

export const MVP_BOSS_SPEC: MvpBossSpec = {
  enemy: boss,
  learnedFromEliteId: learnedFromElite.id,
  learnedMechanic: "교정 입력",
  signatureActionIds,
  selectionReason:
    "4층 붉은 교정관에서 익힌 교정 입력 대응을 5층 보스의 red-edit로 다시 검증하고, word-storm으로 입력 압박을 확장한다.",
  failureModes: [
    {
      cause: "red-edit 예고 후에도 기존 입력 규칙을 고집해 오입력이 누적된다.",
      response: "교정 예고를 확인한 뒤 변경된 입력 규칙에 맞춰 커맨드를 다시 입력한다.",
    },
    {
      cause: "word-storm의 추가 어절을 무시해 입력 처리량이 공격 타이밍을 따라가지 못한다.",
      response: "추가 어절을 우선 처리하고 긴 커맨드보다 짧고 정확한 입력을 선택해 타이밍을 확보한다.",
    },
  ],
  alternatives: [
    {
      enemyId: "thousand-beat-chorus",
      excludedReason:
        "10층 소환체와 중첩 공격 관리까지 요구해 첫 MVP 보스가 검증해야 할 교정 입력 학습 흐름보다 범위가 넓다.",
    },
  ],
  requiredAnimations: collectRequiredAnimations(boss),
};
