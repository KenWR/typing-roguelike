import { describe, expect, test } from "bun:test";
import { getRewardSourcePresentation } from "../src/game/rewards/reward-source-presentation";

describe("reward source presentation", () => {
  test("keeps combat victory reward presentation", () => {
    expect(getRewardSourcePresentation("combat-victory", "전투 보상")).toEqual({
      title: "전투 보상",
      meta: "VICTORY",
    });
  });

  test("uses exploration presentation for map reward nodes", () => {
    expect(getRewardSourcePresentation("map-reward", "전투 보상")).toEqual({
      title: "탐색 보상",
      meta: "DISCOVERY",
    });
  });
});
