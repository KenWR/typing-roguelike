import { describe, expect, test } from "bun:test";
import {
  MVP_NORMAL_ENEMY_IDS,
  MVP_NORMAL_ENEMY_SPECS,
} from "../src/content/mvp-normal-enemies.ts";

describe("MVP normal enemy roster", () => {
  test("selects exactly two early normal enemies with different learning points", () => {
    expect(MVP_NORMAL_ENEMY_IDS).toEqual(["ink-slime", "hook-tentacle"]);
    expect(MVP_NORMAL_ENEMY_SPECS).toHaveLength(2);

    const roles = new Set(MVP_NORMAL_ENEMY_SPECS.map(({ enemy }) => enemy.role));
    const learningPoints = new Set(
      MVP_NORMAL_ENEMY_SPECS.map(({ learningPoint }) => learningPoint),
    );

    expect(roles.size).toBe(2);
    expect(learningPoints.size).toBe(2);
  });

  test("keeps attack, response, reward, and motion requirements explicit", () => {
    for (const spec of MVP_NORMAL_ENEMY_SPECS) {
      expect(spec.enemy.tier).toBe("normal");
      expect(spec.enemy.allowedFloors).toContain(1);
      expect(spec.enemy.actions.some(({ kind }) => kind === "attack")).toBe(true);
      expect(spec.enemy.actions.some(({ kind }) => kind === "special")).toBe(true);
      expect(spec.response.length).toBeGreaterThan(0);
      expect(spec.reward.weight).toBeGreaterThan(0);
      expect(spec.requiredAnimations.length).toBeGreaterThan(0);

      for (const action of spec.enemy.actions) {
        expect(spec.requiredAnimations).toContain(action.animation.windup);
        if (action.animation.impact !== undefined) {
          expect(spec.requiredAnimations).toContain(action.animation.impact);
        }
        if (action.animation.recovery !== undefined) {
          expect(spec.requiredAnimations).toContain(action.animation.recovery);
        }
      }
    }
  });
});
