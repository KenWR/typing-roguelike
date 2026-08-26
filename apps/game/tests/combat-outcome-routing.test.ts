import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
} from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import {
  calculateCombatVictoryGold,
  finalizeCombatOutcome,
} from "../src/game/combat/combat-outcome-routing";
import type { RewardSelectionAdapter } from "../src/game/rewards/reward-selection-adapter";
import type { RunState } from "@typing-roguelike/shared";

const createInProgressRun = (currentRound = 1): RunState => {
  const runState = createInitialRunState({ seed: 55 });
  return {
    ...runState,
    map: {
      ...runState.map,
      currentNodeId: "node-1",
      currentRound,
      choicePath: Array.from({ length: currentRound - 1 }, () => 1),
      nodeStatuses: {
        "node-1": "in_progress" as const,
        "node-2": "locked" as const,
      },
    },
  };
};

describe("combat outcome routing", () => {
  test("scales victory gold by floor and reward tier", () => {
    expect(calculateCombatVictoryGold(1, "normal")).toBe(10);
    expect(calculateCombatVictoryGold(4, "elite")).toBe(80);
    expect(calculateCombatVictoryGold(5, "boss")).toBe(150);
  });

  test("victory stops combat, grants gold, clears the node and opens reward selection", () => {
    const combat = new CombatState();
    const timeline = new EnemyAttackTimeline();
    const runState = createInProgressRun(3);
    const ownedEquipmentId = EQUIPMENT_CONFIGS.find(
      ({ rarity }) => rarity !== "hidden",
    )!.id;
    const result = finalizeCombatOutcome({
      combat,
      enemyTimeline: timeline,
      runState: {
        ...runState,
        runCurrency: 7,
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
    expect(result.runState.runCurrency).toBe(37);
    expect(result.payload.goldReward).toBe(30);
    expect(result.payload.rewardSource).toBe("combat-victory");
    expect(result.runState.map.nodeStatuses["node-1"]).toBe("cleared");
    expect(result.runState.map.nodeStatuses["node-2"]).toBe("available");
    expect(result.payload.nextSceneKey).toBe("MapScene");

    const adapter = result.payload.adapter as RewardSelectionAdapter<RunState>;
    const candidates = adapter.getViewState().candidates;
    expect(candidates).toHaveLength(3);
    expect(result.payload.rewardEquipmentIds).toEqual(
      candidates.filter(({ kind }) => kind === "weapon").map(({ id }) => id),
    );
    expect(result.payload.rewardRelicIds).toEqual(
      candidates.filter(({ kind }) => kind === "relic").map(({ id }) => id),
    );
    expect(candidates.filter(({ kind }) => kind === "relic")).toHaveLength(2);
    expect(candidates.some(({ id }) => id === ownedEquipmentId)).toBe(false);

    const selectedEquipmentId = candidates[0]!.id;
    adapter.selectReward(selectedEquipmentId);
    adapter.continue();
    expect(adapter.getRunState().runCurrency).toBe(37);
    expect(adapter.getRunState().inventory.itemInstances).toContain(
      selectedEquipmentId,
    );
  });

  test("elite victory grants the higher tier gold reward", () => {
    const result = finalizeCombatOutcome({
      combat: new CombatState(),
      enemyTimeline: new EnemyAttackTimeline(),
      runState: createInProgressRun(4),
      outcome: "victory",
      nextNodeIds: ["node-2"],
      rewardTier: "elite",
      rewardRandom: () => 0,
    });

    expect(result.runState.runCurrency).toBe(80);
    expect(result.payload.goldReward).toBe(80);
  });

  test("victory still offers relics when every equipment reward is already owned", () => {
    const runState = createInProgressRun(2);
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
    expect(result.sceneKey).toBe("RewardSelectionScene");
    expect(result.runState.runCurrency).toBe(20);
    expect(result.payload.goldReward).toBe(20);
    expect(result.runState.map.nodeStatuses["node-1"]).toBe("cleared");
    expect(result.runState.map.nodeStatuses["node-2"]).toBe("available");
    const adapter = result.payload.adapter as RewardSelectionAdapter<RunState>;
    expect(adapter.getViewState().candidates.filter(({ kind }) => kind === "relic")).toHaveLength(2);
  });

  test("defeat stops combat, ends the run and grants no gold", () => {
    const combat = new CombatState();
    const timeline = new EnemyAttackTimeline();
    const runState = createInProgressRun();
    const result = finalizeCombatOutcome({
      combat,
      enemyTimeline: timeline,
      runState: { ...runState, runCurrency: 25 },
      outcome: "defeat",
    });

    expect(combat.snapshot.status).toBe("defeat");
    expect(combat.snapshot.canAcceptInput).toBe(false);
    expect(timeline.snapshot.status).toBe("defeat");
    expect(result.runState.status).toBe("dead");
    expect(result.runState.runCurrency).toBe(25);
    expect(result.sceneKey).toBe("RunResultScene");
    expect(result.payload.result).toBe("death");
  });

  test("reapplying a cleared victory result does not grant gold twice", () => {
    const combat = new CombatState();
    const timeline = new EnemyAttackTimeline();
    const first = finalizeCombatOutcome({
      combat,
      enemyTimeline: timeline,
      runState: createInProgressRun(3),
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

    expect(first.runState.runCurrency).toBe(30);
    expect(second.applied).toBe(false);
    expect(second.sceneKey).toBe("MapScene");
    expect(second.runState).toEqual(first.runState);
    expect(second.runState.runCurrency).toBe(30);
  });
});
