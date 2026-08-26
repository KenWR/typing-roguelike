import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  RELIC_CONFIGS,
  beginMapNode,
  createInitialRunState,
} from "@typing-roguelike/shared";
import { createRunRewardSceneEntry } from "../src/game/rewards/run-reward-scene-entry";

const createRewardRun = () => {
  const base = createInitialRunState({ seed: 42 });
  const nodeId = "reward-r1-0";
  const nextNodeIds = ["next-a", "next-b"];
  const available = {
    ...base,
    map: {
      ...base.map,
      nodeStatuses: {
        [nodeId]: "available" as const,
        "next-a": "locked" as const,
        "next-b": "locked" as const,
      },
    },
  };
  return {
    runState: { ...available, map: beginMapNode(available.map, nodeId) },
    nodeId,
    nextNodeIds,
  };
};

describe("run reward scene entry", () => {
  test("builds real equipment rewards from RunState and routes back to map", () => {
    const { runState, nodeId, nextNodeIds } = createRewardRun();
    const entry = createRunRewardSceneEntry({ runState, nodeId, nextNodeIds });
    const state = entry.adapter.getViewState();

    expect(entry.nextSceneKey).toBe("MapScene");
    expect(state.round).toBe(runState.map.currentRound);
    expect(state.currency).toBe(runState.runCurrency);
    expect(state.candidates.length).toBeGreaterThan(0);
    // 보상에는 장비와 유물이 섞여 나온다.
    expect(state.candidates.every((candidate) =>
      candidate.kind === "relic"
        ? RELIC_CONFIGS.some((relic) => relic.id === candidate.id)
        : EQUIPMENT_CONFIGS.some((equipment) => equipment.id === candidate.id),
    )).toBe(true);
    expect(state.candidates.some((candidate) => candidate.kind === "weapon")).toBe(true);
  });

  test("applies one selection, completes the node, unlocks next nodes, and calls persistence once", () => {
    const { runState, nodeId, nextNodeIds } = createRewardRun();
    const persisted = [] as typeof runState[];
    const entry = createRunRewardSceneEntry({
      runState,
      nodeId,
      nextNodeIds,
      onContinue: (nextRun) => persisted.push(nextRun),
    });
    const candidate = entry.adapter.getViewState().candidates[0]!;
    const equipment = EQUIPMENT_CONFIGS.find((item) => item.id === candidate.id)!;

    entry.adapter.selectReward(candidate.id);
    entry.adapter.continue();

    const nextRun = entry.adapter.getRunState();
    expect(nextRun.inventory.itemInstances.filter((id) => id === equipment.id)).toHaveLength(1);
    if (equipment.slot === "weapon") {
      expect(nextRun.loadout.weaponId).toBe(equipment.id);
    } else {
      expect(nextRun.loadout.subweaponId).toBe(equipment.id);
    }
    expect(nextRun.runCurrency).toBe(runState.runCurrency);
    expect(nextRun.map.nodeStatuses[nodeId]).toBe("cleared");
    expect(nextRun.map.nodeStatuses["next-a"]).toBe("available");
    expect(nextRun.map.nodeStatuses["next-b"]).toBe("available");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toEqual(nextRun);

    expect(() => entry.adapter.continue()).toThrow("already complete");
    expect(entry.adapter.getRunState()).toEqual(nextRun);
    expect(persisted).toHaveLength(1);
  });

  test("candidate generation is stable for the same run and reward node", () => {
    const { runState, nodeId, nextNodeIds } = createRewardRun();
    const first = createRunRewardSceneEntry({ runState, nodeId, nextNodeIds });
    const second = createRunRewardSceneEntry({ runState, nodeId, nextNodeIds });

    expect(first.adapter.getViewState().candidates.map((candidate) => candidate.id)).toEqual(
      second.adapter.getViewState().candidates.map((candidate) => candidate.id),
    );
  });
});
