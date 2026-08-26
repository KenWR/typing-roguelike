import { describe, expect, test } from "bun:test";
import { ENEMY_BY_ID } from "../src/content/enemies.ts";
import { MVP_BOSS_SPEC } from "../src/content/mvp-boss.ts";

describe("MVP boss content contract", () => {
  test("selects Palimpsest as a boss with representative special actions", () => {
    expect(MVP_BOSS_SPEC.enemy.id).toBe("palimpsest");
    expect(MVP_BOSS_SPEC.enemy.tier).toBe("boss");
    expect(MVP_BOSS_SPEC.enemy.allowedFloors).toContain(5);
    expect(MVP_BOSS_SPEC.signatureActionIds.length).toBeGreaterThanOrEqual(1);

    for (const actionId of MVP_BOSS_SPEC.signatureActionIds) {
      expect(
        MVP_BOSS_SPEC.enemy.actions.some(
          (action) => action.id === actionId && action.kind === "special",
        ),
      ).toBe(true);
    }
  });

  test("reuses the correction lesson while expressing the boss effect as AP drain", () => {
    const elite = ENEMY_BY_ID.get(MVP_BOSS_SPEC.learnedFromEliteId);
    const redEdit = MVP_BOSS_SPEC.enemy.actions.find(
      (action) => action.id === "palimpsest-red-edit",
    );

    expect(elite?.tier).toBe("elite");
    expect(elite?.allowedFloors).toContain(4);
    expect(
      elite?.actions.some((action) => action.description.includes("교정")),
    ).toBe(true);
    expect(redEdit?.kind).toBe("special");
    expect(redEdit?.description).toBe("플레이어 AP를 1 감소시킵니다.");
    expect(redEdit?.apDelta).toBe(-1);
    expect(MVP_BOSS_SPEC.learnedMechanic).toContain("교정");
  });

  test("documents readable failure causes and player responses", () => {
    expect(MVP_BOSS_SPEC.failureModes.length).toBeGreaterThanOrEqual(2);

    for (const failure of MVP_BOSS_SPEC.failureModes) {
      expect(failure.cause.length).toBeGreaterThan(0);
      expect(failure.response.length).toBeGreaterThan(0);
    }
  });

  test("records why the later chorus boss is outside the first MVP scope", () => {
    const alternative = MVP_BOSS_SPEC.alternatives.find(
      ({ enemyId }) => enemyId === "thousand-beat-chorus",
    );

    expect(alternative).toBeDefined();
    expect(alternative?.excludedReason.length).toBeGreaterThan(0);
  });

  test("derives required motion keys from the selected boss actions", () => {
    expect(MVP_BOSS_SPEC.requiredAnimations.length).toBeGreaterThan(0);

    for (const action of MVP_BOSS_SPEC.enemy.actions) {
      expect(MVP_BOSS_SPEC.requiredAnimations).toContain(action.animation.windup);
      if (action.animation.impact !== undefined) {
        expect(MVP_BOSS_SPEC.requiredAnimations).toContain(action.animation.impact);
      }
      if (action.animation.recovery !== undefined) {
        expect(MVP_BOSS_SPEC.requiredAnimations).toContain(action.animation.recovery);
      }
    }
  });
});
