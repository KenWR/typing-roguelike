import { describe, expect, test } from "bun:test";
import { ENEMY_CONFIGS } from "../src/content/enemies";

describe("enemy action names", () => {
  test("does not expose the generic special action label", () => {
    const specialActions = ENEMY_CONFIGS.flatMap((enemy) =>
      enemy.actions.filter((action) => action.kind === "special"),
    );

    expect(specialActions.length).toBeGreaterThan(0);
    expect(specialActions.every((action) => action.name !== "특수기술")).toBe(true);
  });

  test("uses explicit boss special skill names", () => {
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
