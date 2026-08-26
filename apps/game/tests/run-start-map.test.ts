import { describe, expect, test } from "bun:test";
import { createInitialRunState, generateNodeChoices, START_NODE_KEY } from "@typing-roguelike/shared";
import { getAvailableNodeIds, initializeRunMap } from "../src/game/run/run-start-map";

describe("initializeRunMap", () => {
  test("marks only first-round nodes as available at run start", () => {
    const state = createInitialRunState({ seed: 1234 });
    const initialized = initializeRunMap(state);
    const firstRoundKeys = generateNodeChoices(1234, 1, []).map((node) => node.key);

    expect(initialized.map.currentNodeId).toBe(START_NODE_KEY);
    expect(initialized.map.currentRound).toBe(1);
    expect(initialized.map.choicePath).toEqual([]);
    expect(getAvailableNodeIds(initialized).sort()).toEqual(firstRoundKeys.sort());
    expect(Object.values(initialized.map.nodeStatuses)).toEqual([
      "available",
      "available",
      "available",
    ]);
  });

  test("replaces stale map progress with a fresh first-round state", () => {
    const state = createInitialRunState({ seed: 9 });
    state.map.currentNodeId = "old-node";
    state.map.currentRound = 4;
    state.map.choicePath = [1, 2, 3];
    state.map.nodeStatuses = { "old-node": "cleared" };

    const initialized = initializeRunMap(state);

    expect(initialized.map.currentNodeId).toBe(START_NODE_KEY);
    expect(initialized.map.currentRound).toBe(1);
    expect(initialized.map.choicePath).toEqual([]);
    expect(initialized.map.nodeStatuses["old-node"]).toBeUndefined();
  });
});
