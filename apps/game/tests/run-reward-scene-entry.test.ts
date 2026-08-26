import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
} from "@typing-roguelike/shared";
import { createRunRewardSceneEntry } from "../src/game/rewards/run-reward-scene-entry";

describe("run reward scene entry", () => {
  test("builds real equipment rewards from RunState and routes back to map", () => {
    const runState = createInitialRunState({ seed: 42 });
    const entry = createRunRewardSceneEntry(runState);
    const state = entry.adapter.getViewState();

    expect(entry.nextSceneKey).toBe("MapScene");
    expect(state.candidates.length).toBeGreaterThan(0);
    expect(state.candidates.every((candidate) =>
      EQUIPMENT_CONFIGS.some((equipment) => equipment.id === candidate.id),
    )).toBe(true);
  });

  test("applies selected equipment to inventory and loadout before continuing", () => {
    const runState = createInitialRunState({ seed: 7 });
    const entry = createRunRewardSceneEntry(runState);
    const candidate = entry.adapter.getViewState().candidates[0]!;
    const equipment = EQUIPMENT_CONFIGS.find((item) => item.id === candidate.id)!;

    entry.adapter.selectReward(candidate.id);
    entry.adapter.continue();

    const nextRun = entry.adapter.getRunState();
    expect(nextRun.inventory.itemInstances).toContain(equipment.id);
    if (equipment.slot === "weapon") {
      expect(nextRun.loadout.weaponId).toBe(equipment.id);
    } else {
      expect(nextRun.loadout.subweaponId).toBe(equipment.id);
    }
  });
});
