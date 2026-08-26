import { ENEMY_BY_ID } from "./enemies.ts";

export type MvpEliteLearningContract = Readonly<{
  enemyId: string;
  bossId: string;
  learningPoint: string;
  linkedEliteActionId: string;
  linkedBossActionId: string;
  playerResponse: string;
  riskReward: string;
  requiredMotionKeys: readonly string[];
}>;

const elite = ENEMY_BY_ID.get("red-corrector");
const boss = ENEMY_BY_ID.get("palimpsest");

if (elite === undefined || boss === undefined) {
  throw new Error("MVP elite contract requires red-corrector and palimpsest enemy data.");
}

const requiredMotionKeys = Array.from(
  new Set(
    elite.actions.flatMap((action) =>
      [action.animation.windup, action.animation.impact, action.animation.recovery].filter(
        (key): key is string => key !== undefined,
      ),
    ),
  ),
);

export const MVP_ELITE: MvpEliteLearningContract = {
  enemyId: elite.id,
  bossId: boss.id,
  learningPoint: "교정 입력 예고를 읽고 평소 입력 습관을 멈춘 뒤 표시된 규칙에 맞춰 대응한다.",
  linkedEliteActionId: `${elite.id}-attack`,
  linkedBossActionId: `${boss.id}-red-edit`,
  playerResponse: "교정 입력이 예고되면 자동적으로 타이핑하지 말고 현재 표시된 입력 규칙을 확인한 뒤 커맨드를 완성한다.",
  riskReward: "일반 적보다 높은 체력과 공격 피해, 엘리트 보상 가중치를 가지며 첫 보스 직전 4층에서 교정 기믹을 학습시킨다.",
  requiredMotionKeys,
};
