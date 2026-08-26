import { describe, expect, test } from "bun:test";
import {
  createEnemyHealthBarState,
  formatEnemyHealthBarLabel,
  resolveEnemyTelegraphEffectLabel,
} from "../src/game/combat/enemy-health-bar";

describe("enemy health bar", () => {
  test("keeps each enemy's hp and fill ratio independent", () => {
    expect(createEnemyHealthBarState(24, 30)).toMatchObject({
      currentHp: 24,
      maxHp: 30,
      healthRatio: 0.8,
      shieldRatio: 0,
      defeated: false,
    });
    expect(createEnemyHealthBarState(12, 40)).toMatchObject({
      currentHp: 12,
      maxHp: 40,
      healthRatio: 0.3,
      shieldRatio: 0,
      defeated: false,
    });
  });

  test("starts each enemy telegraph empty until its own action begins", () => {
    expect(createEnemyHealthBarState(24, 30)).toMatchObject({
      telegraphAttackName: "",
      telegraphAttackType: null,
      telegraphProgress: 0,
    });
  });

  test("keeps buff and debuff labels above the attack name without labeling attacks", () => {
    expect(resolveEnemyTelegraphEffectLabel("buff")).toBe("BUFF");
    expect(resolveEnemyTelegraphEffectLabel("debuff")).toBe("DEBUFF");
    expect(resolveEnemyTelegraphEffectLabel("attack")).toBe("");
    expect(resolveEnemyTelegraphEffectLabel("defense")).toBe("");
  });

  test("formats hp and shield totals beside each other", () => {
    const state = createEnemyHealthBarState(56, 56, {
      shield: 0,
      maxShield: 30,
    });

    expect(formatEnemyHealthBarLabel(state)).toBe("HP 56/56   SHD 0/30");
  });

  test("clamps a current shield to its configured maximum", () => {
    expect(createEnemyHealthBarState(40, 40, { shield: 80, maxShield: 30 })).toMatchObject({
      shield: 30,
      maxShield: 30,
      healthRatio: 40 / 70,
      shieldRatio: 30 / 70,
    });
  });

  test("scales a full HP bar and shield to their combined total", () => {
    expect(createEnemyHealthBarState(100, 100, { shield: 50, maxShield: 50 })).toMatchObject({
      healthRatio: 2 / 3,
      shieldRatio: 1 / 3,
    });
  });

  test("places remaining shield after the health fill", () => {
    expect(createEnemyHealthBarState(60, 100, { shield: 25 })).toMatchObject({
      healthRatio: 0.6,
      shield: 25,
      shieldRatio: 0.25,
    });
  });

  test("clamps hp and shield values and keeps target state", () => {
    expect(createEnemyHealthBarState(-10, 40, { shield: 80, targeted: true })).toMatchObject({
      currentHp: 0,
      maxHp: 40,
      healthRatio: 0,
      shield: 80,
      shieldRatio: 1,
      targeted: true,
      defeated: true,
    });
  });
});
