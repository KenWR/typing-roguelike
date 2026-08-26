import { describe, expect, test } from "bun:test";
import {
  createInitialRunState,
  generateNodeChoices,
  type RunState,
} from "@typing-roguelike/shared";
import { resolveRunResumeRoute } from "../src/game/run/run-resume-routing";
import { initializeRunMap } from "../src/game/run/run-start-map";
import { SCENE_KEYS } from "../src/game/scenes/scene-contract";

const createMapRun = (seed = 17): RunState =>
  initializeRunMap(createInitialRunState({ seed }));

const createSelectedRun = (
  status: "available" | "in_progress",
  includePersistedSelection = false,
): RunState => {
  const runState = createMapRun();
  const node = generateNodeChoices(runState.map.seed, 1, [])[0]!;
  return {
    ...runState,
    map: {
      ...runState.map,
      currentNodeId: node.key,
      choicePath: includePersistedSelection ? [node.choice] : [],
      nodeStatuses: {
        ...runState.map.nodeStatuses,
        [node.key]: status,
      },
    },
  };
};

describe("run resume routing", () => {
  test("recovers a legacy in-progress node as an available map choice", () => {
    const legacyRun = createSelectedRun("in_progress");
    const route = resolveRunResumeRoute(legacyRun, {
      sceneKey: SCENE_KEYS.shop,
      stale: true,
    });
    const resumedRun = route.payload.runState as RunState;

    expect(route.sceneKey).toBe(SCENE_KEYS.map);
    expect(route.recovered).toBe(true);
    expect(resumedRun.map.nodeStatuses[resumedRun.map.currentNodeId]).toBe("available");
    expect(route.payload.recoveryAvailable).toBe(true);
  });

  test("always routes a normal active run to map selection", () => {
    const runState = createMapRun();
    const route = resolveRunResumeRoute(runState, null);

    expect(route.sceneKey).toBe(SCENE_KEYS.map);
    expect(route.recovered).toBe(false);
    expect(route.payload.runState).toBe(runState);
  });

  test("removes the extra selection choice from a server checkpoint before map selection", () => {
    const selectedRun = createSelectedRun("available", true);
    const route = resolveRunResumeRoute(selectedRun, null);
    const resumedRun = route.payload.runState as RunState;

    expect(route.sceneKey).toBe(SCENE_KEYS.map);
    expect(route.recovered).toBe(true);
    expect(resumedRun.map.choicePath).toEqual([]);
    expect(resumedRun.map.nodeStatuses[resumedRun.map.currentNodeId]).toBe("available");
  });
});
