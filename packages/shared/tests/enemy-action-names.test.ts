import { describe, expect, test } from "bun:test";
import { ENEMY_CONFIGS } from "../src/content/enemies";

describe("enemy action names", () => {
  test("does not expose generic or description-like special action labels", () => {
    const specialActions = ENEMY_CONFIGS.flatMap((enemy) =>
      enemy.actions.filter((action) => action.kind === "special"),
    );

    expect(specialActions.length).toBeGreaterThan(0);
    expect(specialActions.every((action) => action.name.trim().length > 0)).toBe(true);
    expect(specialActions.every((action) => action.name !== "특수기술")).toBe(true);
    expect(specialActions.every((action) => action.name !== action.description)).toBe(true);
  });

  test("uses explicit names for normal and elite enemy specials", () => {
    const expectedNames = new Map([
      ["ink-slime", "먹물 압착"],
      ["hook-tentacle", "갈고리 휘감기"],
      ["iron-beetle", "철갑 돌진"],
      ["bell-wraith", "두 번째 울림"],
      ["mimic-doll", "따라 하기"],
      ["reverse-bat", "역철자 울음"],
      ["space-eater", "공백 포식"],
      ["needle-gunner", "바늘 연사"],
      ["red-scribe", "붉은 가속문"],
      ["repair-golem", "수복 파동"],
      ["explosive-spore", "포자 폭쇄"],
      ["chain-executor", "사슬 구속"],
      ["mirror-doll", "거울 반사"],
      ["clock-tick", "초침 가속"],
      ["ap-devourer", "행동력 흡식"],
      ["red-corrector", "교정쇄"],
      ["inverted-knight", "역순 참격"],
      ["chorus-conductor", "동기화 지휘"],
      ["beat-tentacle", "박자 채찍"],
    ] as const);

    for (const [enemyId, expectedName] of expectedNames) {
      const enemy = ENEMY_CONFIGS.find((candidate) => candidate.id === enemyId);
      const special = enemy?.actions.find((action) => action.kind === "special");
      expect(special?.name).toBe(expectedName);
    }
  });

  test("keeps explicit boss special skill names", () => {
    const palimpsest = ENEMY_CONFIGS.find((enemy) => enemy.id === "palimpsest");
    const chorus = ENEMY_CONFIGS.find((enemy) => enemy.id === "thousand-beat-chorus");

    expect(palimpsest?.actions.filter((action) => action.kind === "special").map((action) => action.name)).toEqual([
      "어절 폭풍",
      "붉은 교정",
    ]);
    expect(chorus?.actions.filter((action) => action.kind === "special").map((action) => action.name)).toEqual([
      "대합창",
      "크레센도",
    ]);
  });
});
