import { describe, expect, test } from "bun:test";
import {
  COMBAT_BACKGROUND_ASSET,
  ENEMY_IMAGE_ASSETS,
  resolveEnemyTextureKey,
  resolveEnemyVisualState,
} from "../src/game/assets/enemy-visual-assets";

describe("enemy visual assets", () => {
  test("preloads the combat background and every visual state", () => {
    expect(COMBAT_BACKGROUND_ASSET.path).toBe("/assets/background/전투 배경.png");
    expect(ENEMY_IMAGE_ASSETS).toContainEqual({
      key: "enemy:ink-slime:ready",
      path: "/assets/monster/먹물 슬라임_행동준비.png",
    });
    expect(ENEMY_IMAGE_ASSETS).toContainEqual({
      key: "enemy:ink-slime:special",
      path: "/assets/monster/먹물 슬라임_특수행동준비.png",
    });
    expect(ENEMY_IMAGE_ASSETS).toContainEqual({
      key: "enemy:ink-slime:disabled",
      path: "/assets/monster/먹물 슬라임_행동불능.png",
    });
  });

  test("resolves known enemy states and leaves unknown enemies on the placeholder", () => {
    expect(resolveEnemyTextureKey("iron-beetle", "defend")).toBe(
      "enemy:iron-beetle:defend",
    );
    expect(resolveEnemyTextureKey("unknown")).toBeUndefined();
    expect(resolveEnemyTextureKey(undefined)).toBeUndefined();
  });

  test("prioritizes disabled, hit, defense, special, and ready visuals", () => {
    expect(resolveEnemyVisualState({
      currentHp: 0,
      hitRemainingMs: 200,
      activeAttackId: "ink-slime-special",
    })).toBe("disabled");
    expect(resolveEnemyVisualState({
      currentHp: 10,
      hitRemainingMs: 200,
      activeAttackId: "ink-slime-defense",
    })).toBe("hit");
    expect(resolveEnemyVisualState({
      currentHp: 10,
      hitRemainingMs: 0,
      activeAttackId: "ink-slime-defense",
    })).toBe("defend");
    expect(resolveEnemyVisualState({
      currentHp: 10,
      hitRemainingMs: 0,
      activeAttackId: "ink-slime-special",
    })).toBe("special");
    expect(resolveEnemyVisualState({
      currentHp: 10,
      hitRemainingMs: 0,
      activeAttackId: "ink-slime-attack",
    })).toBe("ready");
  });
});