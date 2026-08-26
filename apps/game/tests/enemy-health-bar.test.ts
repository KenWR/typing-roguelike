import { describe, expect, test } from "bun:test";
import { createEnemyHealthBarState } from "../src/game/combat/enemy-health-bar";

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

  test("places remaining shield after the health fill", () => {
    expect(createEnemyHealthBarState(60, 100, { shield: 25 })).toMatchObject({
      healthRatio: 0.6,
      shield: 25,
      shieldRatio: 0.25,
    });
  });

  test("clamps hp and shield values and keeps target state", () => {
    expect(
      createEnemyHealthBarState(-10, 40, { shield: 80, targeted: true }),
    ).toMatchObject({
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
