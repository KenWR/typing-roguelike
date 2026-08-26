import { describe, expect, test } from "bun:test";
import { ENEMY_BY_ID, ENEMY_CONFIGS } from "../src/content/enemies";

const specialOf = (enemyId: string) =>
  ENEMY_BY_ID.get(enemyId)?.actions.find((action) => action.kind === "special");

describe("enemy AP effects", () => {
  test("converts old input/recovery timing penalties into explicit AP drain", () => {
    expect(specialOf("ink-slime")).toMatchObject({
      name: "먹물 압착",
      apDelta: -1,
      description: "플레이어 AP를 1 감소시킵니다.",
    });
    expect(specialOf("hook-tentacle")).toMatchObject({
      name: "갈고리 휘감기",
      apDelta: -1,
      description: "플레이어 AP를 1 감소시킵니다.",
    });
    expect(specialOf("ap-devourer")).toMatchObject({
      name: "행동력 흡식",
      apDelta: -2,
    });
  });

  test("does not leave input time-limit descriptions in live enemy content", () => {
    const descriptions = ENEMY_CONFIGS.flatMap((enemy) =>
      enemy.actions.map((action) => action.description),
    );
    expect(descriptions.some((description) => description.includes("입력 제한시간"))).toBe(false);
  });

  test("boss disruption specials use explicit AP drain rather than hidden input timing rules", () => {
    const palimpsest = ENEMY_BY_ID.get("palimpsest");
    expect(palimpsest?.actions.filter((action) => action.kind === "special").every((action) => action.apDelta === -1)).toBe(true);
  });
});
