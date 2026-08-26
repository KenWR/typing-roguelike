import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
} from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { finalizeCombatOutcome } from "../src/game/combat/combat-outcome-routing";
import type { RewardSelectionAdapter } from "../src/game/rewards/reward-selection-adapter";
import type { RunState } from "@typing-roguelike/shared";

const createInProgressRun = (): RunState => {
  const runState = createInitialRunState({ seed: 55 });
  return {
    ...runState,
    map: {
      ...runState.map,
      currentNodeId: "node-1",
      nodeStatuses: {
        "node-1": "in_progress" as const,
        "node-2": "locked" as const,
      },
    },
  };
};

describe("combat outcome routing", () => {
  test("victory stops combat, clears the node and opens reward selection", () => {
    const combat = new CombatState();
    const timeline = new EnemyAttackTimeline();
    const runState = createInProgressRun();
    const ownedEquipmentId = EQUIPMENT_CONFIGS.find(
      ({ rarity }) => rarity !== "hidden",
    )!.id;
    const result = finalizeCombatOutcome({
      combat,
      enemyTimeline: timeline,
      runState: {
        ...runState,
        inventory: {
          ...runState.inventory,
          itemInstances: [ownedEquipmentId],
        },
      },
      outcome: "victory",
      nextNodeIds: ["node-2"],
      rewardRandom: () => 0,
    });

    expect(combat.snapshot.status).toBe("victory");
    expect(combat.snapshot.canAcceptInput).toBe(false);
    expect(timeline.snapshot.status).toBe("victory");
    expect(result.sceneKey).toBe("RewardSelectionScene");
    expect(result.runState.map.nodeStatuses["node-1"]).toBe("cleared");
    expect(result.runState.map.nodeStatuses["node-2"]).toBe("available");
    expect(result.payload.nextSceneKey).toBe("MapScene");

    const adapter = result.payload.adapter as RewardSelectionAdapter<RunState>;
    const candidates = adapter.getViewState().candidates;
    expect(candidates).toHaveLength(3);
    expect(candidates.some(({ id }) => id === ownedEquipmentId)).toBe(false);

    const selectedEquipmentId = candidates[0]!.id;
    adapter.selectReward(selectedEquipmentId);
    adapter.continue();
    expect(adapter.getRunState().inventory.itemInstances).toContain(
      selectedEquipmentId,
    );
  });

  test("victory falls back to map when every normal reward is already owned", () => {
    const runState = createInProgressRun();
    const result = finalizeCombatOutcome({
      combat: new CombatState(),
      enemyTimeline: new EnemyAttackTimeline(),
      runState: {
        ...runState,
        inventory: {
          ...runState.inventory,
          itemInstances: EQUIPMENT_CONFIGS.filter(
            ({ rarity }) => rarity !== "hidden",
          ).map(({ id }) => id),
        },
      },
      outcome: "victory",
      nextNodeIds: ["node-2"],
      rewardRandom: () => 0,
    });

    expect(result.applied).toBe(true);
    expect(result.sceneKey).toBe("MapScene");
    expect(result.runState.map.nodeStatuses["node-1"]).toBe("cleared");
    expect(result.runState.map.nodeStatuses["node-2"]).toBe("available");
  });

  test("defeat stops combat, ends the run and routes to death settlement", () => {
    const combat = new CombatState();
    const timeline = new EnemyAttackTimeline();
    const result = finalizeCombatOutcome({
      combat,
      enemyTimeline: timeline,
      runState: createInProgressRun(),
      outcome: "defeat",
    });

    expect(combat.snapshot.status).toBe("defeat");
    expect(combat.snapshot.canAcceptInput).toBe(false);
    expect(timeline.snapshot.status).toBe("defeat");
    expect(result.runState.status).toBe("dead");
    expect(result.sceneKey).toBe("RunResultScene");
    expect(result.payload.result).toBe("death");
  });

  test("reapplying a cleared victory result is idempotent", () => {
    const combat = new CombatState();
    const timeline = new EnemyAttackTimeline();
    const first = finalizeCombatOutcome({
      combat,
      enemyTimeline: timeline,
      runState: createInProgressRun(),
      outcome: "victory",
      nextNodeIds: ["node-2"],
      rewardRandom: () => 0,
    });
    const second = finalizeCombatOutcome({
      combat,
      enemyTimeline: timeline,
      runState: first.runState,
      outcome: "victory",
      nextNodeIds: ["node-2"],
      rewardRandom: () => 0,
    });

    expect(second.applied).toBe(false);
    expect(second.sceneKey).toBe("MapScene");
    expect(second.runState).toEqual(first.runState);
  });
});
