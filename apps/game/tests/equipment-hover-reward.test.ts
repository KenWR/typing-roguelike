import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS, createInitialRunState } from "@typing-roguelike/shared";
import { createRunRewardSelectionFlow } from "../src/game/rewards/run-reward-selection";

describe("equipment reward hover details", () => {
  test("includes hand classification and skill previews for weapon rewards", () => {
    const weapon = EQUIPMENT_CONFIGS.find(
      (candidate) => candidate.slot === "weapon" && candidate.kind === "greatsword",
    );
    if (weapon === undefined) throw new Error("two-handed weapon fixture missing");

    const flow = createRunRewardSelectionFlow({
      runState: createInitialRunState({ seed: 91 }),
      equipmentIds: [weapon.id],
    });
    const candidate = flow.adapter.getViewState().candidates[0];
    if (candidate === undefined) throw new Error("equipment reward candidate missing");

    expect(candidate.description).toContain("양손무기");
    expect(candidate.details).toContain("기본기술");
    expect(candidate.details).toContain("특수기술");
    expect(candidate.details).toContain("command:");
    expect(candidate.details).toContain("cost:");
    expect(candidate.details).toContain("damage:");
  });
});
