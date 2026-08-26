import { describe, expect, test } from "bun:test";
import { createInitialRunState, generateNodeChoices, type RunState } from "@typing-roguelike/shared";
import { routeMapNodeSelection } from "../src/game/run/map-node-routing";
import { SCENE_KEYS } from "../src/game/scenes/scene-contract";

const createSelectableRun = (): { runState: RunState; nodeId: string } => {
  const base = createInitialRunState({ seed: 17 });
  const nodes = generateNodeChoices(base.map.seed, 1, []);
  const selectable = nodes.find((node) => node.type !== "elite") ?? nodes[0]!;
  const nodeStatuses = Object.fromEntries(nodes.map((node) => [node.key, "available" as const]));
  return { nodeId: selectable.key, runState: { ...base, map: { ...base.map, nodeStatuses } } };
};

describe("map node routing", () => {
  test("locked nodes do not transition", () => {
    const { runState, nodeId } = createSelectableRun();
    const locked: RunState = { ...runState, map: { ...runState.map, nodeStatuses: { ...runState.map.nodeStatuses, [nodeId]: "locked" } } };
    const route = routeMapNodeSelection(locked, nodeId);
    expect(route.applied).toBe(false);
    expect(route.sceneKey).toBe(SCENE_KEYS.map);
  });

  test("available node stays available while routing away from map", () => {
    const { runState, nodeId } = createSelectableRun();
    const route = routeMapNodeSelection(runState, nodeId);
    expect(route.applied).toBe(true);
    expect(route.runState.map.currentNodeId).toBe(nodeId);
    expect(route.runState.map.nodeStatuses[nodeId]).toBe("available");
    expect(route.sceneKey).not.toBe(SCENE_KEYS.map);
  });
});
