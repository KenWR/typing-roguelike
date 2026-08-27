import { describe, expect, test } from "bun:test";
import {
  COMBAT_BACKGROUND_ASSET,
  ENEMY_IMAGE_ASSETS,
  resolveEnemyTextureKey,
  resolveEnemyVisualState,
} from "../src/game/assets/enemy-visual-assets";

/** 실행 위치와 무관하게 정적 에셋을 찾도록 테스트 파일 기준으로 해석한다. */
const publicFile = (publicPath: string) =>
  Bun.file(`${import.meta.dir}/../public${publicPath}`);

describe("enemy visual assets", () => {
  test("preloads the combat background and every visual state", () => {
    expect(COMBAT_BACKGROUND_ASSET.path).toBe("/assets/background/전투 배경.png");
    expect(ENEMY_IMAGE_ASSETS).toContainEqual({
      key: "enemy:ink-slime:ready",
      path: "/assets/images/enemies/ink-slime/ready.png",
    });
    expect(ENEMY_IMAGE_ASSETS).toContainEqual({
      key: "enemy:ink-slime:special",
      path: "/assets/images/enemies/ink-slime/special.png",
    });
    expect(ENEMY_IMAGE_ASSETS).toContainEqual({
      key: "enemy:ink-slime:disabled",
      path: "/assets/images/enemies/ink-slime/disabled.png",
    });
    expect(ENEMY_IMAGE_ASSETS).toContainEqual({
      key: "enemy:red-corrector:idle",
      path: "/assets/images/enemies/red-corrector/idle.png",
    });
    expect(ENEMY_IMAGE_ASSETS).toContainEqual({
      key: "enemy:chain-executor:defend",
      path: "/assets/images/enemies/chain-executor/defend.png",
    });
  });

  test("ships a file for every enemy image it preloads", async () => {
    // 카탈로그에만 등록되고 파일이 없으면 전투에서 X 플레이스홀더로 대체된다.
    const missing: string[] = [];

    for (const asset of [COMBAT_BACKGROUND_ASSET, ...ENEMY_IMAGE_ASSETS]) {
      if (!(await publicFile(asset.path).exists())) {
        missing.push(asset.path);
      }
    }

    expect(missing).toEqual([]);
  });

  test("resolves known enemy states and leaves unknown enemies on the placeholder", () => {
    expect(resolveEnemyTextureKey("iron-beetle", "defend")).toBe(
      "enemy:iron-beetle:defend",
    );
    expect(resolveEnemyTextureKey("ink-slime")).toBe("enemy:ink-slime:idle");
    expect(resolveEnemyTextureKey("iron-beetle")).toBe("enemy:iron-beetle:ready");
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
    expect(resolveEnemyVisualState({
      currentHp: 10,
      hitRemainingMs: 0,
    })).toBe("idle");
  });
});
