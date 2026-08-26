import { ENEMY_BY_ID } from "./enemies.ts";
import type { EnemyConfig } from "./types.ts";

export type MvpNormalEnemyLearningPoint =
  | "input-pressure"
  | "timing-pressure";

export type MvpNormalEnemySpec = Readonly<{
  enemy: EnemyConfig;
  learningPoint: MvpNormalEnemyLearningPoint;
  response: string;
  reward: EnemyConfig["reward"];
  requiredAnimations: readonly string[];
}>;

const requireNormalEnemy = (enemyId: string): EnemyConfig => {
  const enemy = ENEMY_BY_ID.get(enemyId);
  if (enemy === undefined) {
    throw new Error(`Unknown MVP enemy id: ${enemyId}`);
  }
  if (enemy.tier !== "normal") {
    throw new Error(`MVP normal enemy must have normal tier: ${enemyId}`);
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

const createMvpNormalEnemySpec = (
  enemyId: string,
  learningPoint: MvpNormalEnemyLearningPoint,
  response: string,
): MvpNormalEnemySpec => {
  const enemy = requireNormalEnemy(enemyId);

  return {
    enemy,
    learningPoint,
    response,
    reward: enemy.reward,
    requiredAnimations: collectRequiredAnimations(enemy),
  };
};

export const MVP_NORMAL_ENEMY_SPECS = [
  createMvpNormalEnemySpec(
    "ink-slime",
    "input-pressure",
    "짧아진 입력 제한시간을 확인하고 짧고 정확한 커맨드로 대응한다.",
  ),
  createMvpNormalEnemySpec(
    "hook-tentacle",
    "timing-pressure",
    "공격 예고를 읽고 긴 후딜을 피하도록 공격과 방어 입력 타이밍을 조절한다.",
  ),
] as const satisfies readonly MvpNormalEnemySpec[];

export const MVP_NORMAL_ENEMY_IDS = MVP_NORMAL_ENEMY_SPECS.map(
  ({ enemy }) => enemy.id,
) as readonly string[];
