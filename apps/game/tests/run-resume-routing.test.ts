import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import { resolveRunResumeRoute } from "../src/game/run/run-resume-routing";
import { SCENE_KEYS } from "../src/game/scenes/scene-contract";

describe("run resume routing", () => {
  test("returns to map and restores a legacy in-progress node to available", () => {
    const initial = createInitialRunState({ seed: 7 });
    const runState = { ...initial, map: { ...initial.map, currentNodeId: "1-1", nodeStatuses: { ...initial.map.nodeStatuses, "1-1": "in_progress" as const } } };
    const route = resolveRunResumeRoute(runState, null);
    expect(route.sceneKey).toBe(SCENE_KEYS.map);
    expect(route.recovered).toBe(true);
    expect((route.payload.runState as typeof runState).map.nodeStatuses["1-1"]).toBe("available");
  });

  test("keeps a normal active map state unchanged", () => {
    const runState = createInitialRunState({ seed: 8 });
    const route = resolveRunResumeRoute(runState, null);
    expect(route.sceneKey).toBe(SCENE_KEYS.map);
    expect(route.recovered).toBe(false);
    expect(route.payload.runState).toBe(runState);
  });
});
