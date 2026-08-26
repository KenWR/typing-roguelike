import { describe, expect, test } from "bun:test";
import { ENEMY_BY_ID, ENEMY_CONFIGS, MVP_ELITE } from "../src/index.ts";

describe("MVP elite content contract", () => {
  test("selects the red corrector immediately before the first boss", () => {
    const elite = ENEMY_BY_ID.get(MVP_ELITE.enemyId);
    const boss = ENEMY_BY_ID.get(MVP_ELITE.bossId);

    expect(elite?.tier).toBe("elite");
    expect(boss?.tier).toBe("boss");
    expect(elite?.allowedFloors).toContain(4);
    expect(boss?.allowedFloors).toContain(5);
  });

  test("links the correction lesson to the boss mechanic", () => {
    const elite = ENEMY_BY_ID.get(MVP_ELITE.enemyId)!;
    const boss = ENEMY_BY_ID.get(MVP_ELITE.bossId)!;
    const eliteAction = elite.actions.find((action) => action.id === MVP_ELITE.linkedEliteActionId);
    const bossAction = boss.actions.find((action) => action.id === MVP_ELITE.linkedBossActionId);

    expect(eliteAction?.description).toContain("교정");
    expect(bossAction?.description).toContain("교정");
    expect(MVP_ELITE.playerResponse.length).toBeGreaterThan(0);
  });

  test("defines higher risk and reward than normal enemies", () => {
    const elite = ENEMY_BY_ID.get(MVP_ELITE.enemyId)!;
    const normalEnemies = ENEMY_CONFIGS.filter((enemy) => enemy.tier === "normal");
    expect(elite.reward.weight).toBeGreaterThan(Math.max(...normalEnemies.map((enemy) => enemy.reward.weight)));
    expect(MVP_ELITE.riskReward.length).toBeGreaterThan(0);
  });

  test("derives required motion keys from elite actions", () => {
    const elite = ENEMY_BY_ID.get(MVP_ELITE.enemyId)!;
    for (const action of elite.actions) {
      expect(MVP_ELITE.requiredMotionKeys).toContain(action.animation.windup);
      if (action.animation.impact !== undefined) expect(MVP_ELITE.requiredMotionKeys).toContain(action.animation.impact);
      if (action.animation.recovery !== undefined) expect(MVP_ELITE.requiredMotionKeys).toContain(action.animation.recovery);
    }
  });
});
