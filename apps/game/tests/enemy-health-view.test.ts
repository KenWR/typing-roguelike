import { describe, expect, test } from "bun:test";
import {
  createEnemyHealthListLabel,
  createEnemyHealthView,
} from "../src/game/combat/enemy-health-view";

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

  test("shows each enemy hp independently in multi-enemy encounters", () => {
    const enemies = [
      { instanceId: "slime:1", name: "먹물 슬라임", hp: 30 },
      { instanceId: "tentacle:1", name: "갈고리 촉수", hp: 40 },
      { instanceId: "scribe:1", name: "붉은 필경사", hp: 25 },
    ];

    expect(
      createEnemyHealthListLabel(enemies, {
        "slime:1": 0,
        "tentacle:1": 31,
        "scribe:1": 12,
      }),
    ).toBe(
      [
        "먹물 슬라임  HP 0 / 30",
        "갈고리 촉수  HP 31 / 40",
        "붉은 필경사  HP 12 / 25",
      ].join("\n"),
    );
  });

  test("uses initial hp when a runtime hp entry is absent", () => {
    expect(
      createEnemyHealthListLabel(
        [{ instanceId: "slime:1", name: "먹물 슬라임", hp: 30 }],
        {},
      ),
    ).toBe("먹물 슬라임  HP 30 / 30");
  });
});
