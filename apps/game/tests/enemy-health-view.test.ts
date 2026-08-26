import { describe, expect, test } from "bun:test";
import { createEnemyHealthView } from "../src/game/combat/enemy-health-view";

describe("enemy health view", () => {
  test("shows enemy name and current/max hp", () => {
    expect(createEnemyHealthView("먹물 슬라임", 18, 30)).toEqual({
      name: "먹물 슬라임",
      currentHp: 18,
      maxHp: 30,
      label: "먹물 슬라임  HP 18 / 30",
    });
  });

  test("clamps hp to zero and max hp", () => {
    expect(createEnemyHealthView("갈고리 촉수", -5, 40).label).toBe(
      "갈고리 촉수  HP 0 / 40",
    );
    expect(createEnemyHealthView("갈고리 촉수", 99, 40).label).toBe(
      "갈고리 촉수  HP 40 / 40",
    );
  });

  test("uses a safe fallback when enemy data is missing", () => {
    expect(createEnemyHealthView(undefined, undefined, undefined).label).toBe(
      "알 수 없는 적  HP 0 / 0",
    );
  });
});
