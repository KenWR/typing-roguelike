import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { finalizeCombatOutcome } from "../src/game/combat/combat-outcome-routing";

const createInProgressRun = () => {
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
  test("victory stops combat, clears the current node and opens next nodes", () => {
    const combat = new CombatState();
    const timeline = new EnemyAttackTimeline();
    const result = finalizeCombatOutcome({
      combat,
      enemyTimeline: timeline,
      runState: createInProgressRun(),
      outcome: "victory",
      nextNodeIds: ["node-2"],
    });

    expect(combat.snapshot.status).toBe("victory");
    expect(combat.snapshot.canAcceptInput).toBe(false);
    expect(timeline.snapshot.status).toBe("victory");
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
    });
    const second = finalizeCombatOutcome({
      combat,
      enemyTimeline: timeline,
      runState: first.runState,
      outcome: "victory",
      nextNodeIds: ["node-2"],
    });

    expect(second.applied).toBe(false);
    expect(second.runState).toEqual(first.runState);
  });
});
