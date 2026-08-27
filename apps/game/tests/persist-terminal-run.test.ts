import { describe, expect, test } from "bun:test";
import {
  createInitialRunState,
  type GeneratedMapNode,
  type RunState,
} from "@typing-roguelike/shared";
import type { CombatOutcomeRoute } from "../src/game/combat/combat-outcome-routing";
import {
  persistCombatRunTransition,
  persistTerminalRunTransition,
} from "../src/game/run/persist-terminal-run";
import { RunSession } from "../src/game/run/run-session";
import { SCENE_KEYS } from "../src/game/scenes/scene-contract";

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

const createResultRoute = (
  status: Extract<RunState["status"], "dead" | "cleared">,
): CombatOutcomeRoute => {
  const runState: RunState = {
    ...createInitialRunState({ seed: status === "dead" ? 401 : 402 }),
    status,
  };
  return {
    applied: true,
    runState,
    sceneKey: SCENE_KEYS.runResult,
    payload: {
      runState,
      result: status === "dead" ? "death" : "clear",
    },
  };
};

describe("terminal run transition persistence", () => {
  test.each(["dead", "cleared"] as const)(
    "stores the %s state before entering the result scene",
    (status) => {
      const storage = createMemoryStorage();
      const session = new RunSession(storage);
      session.replace(createInitialRunState({ seed: 400 }));

      expect(persistTerminalRunTransition(createResultRoute(status), session)).toBe(true);
      expect(new RunSession(storage).restore()?.status).toBe(status);
    },
  );

  test("does not persist a non-terminal route as a terminal transition", () => {
    const storage = createMemoryStorage();
    const session = new RunSession(storage);
    const runState = createInitialRunState({ seed: 403 });
    const route: CombatOutcomeRoute = {
      applied: true,
      runState,
      sceneKey: SCENE_KEYS.map,
      payload: { runState },
    };

    expect(persistTerminalRunTransition(route, session)).toBe(false);
    expect(session.get()).toBeNull();
  });
});

describe("combat route transition persistence", () => {
  test("stores victory progress and the exact unclaimed reward candidates", () => {
    const storage = createMemoryStorage();
    const session = new RunSession(storage);
    const initial = createInitialRunState({ seed: 404 });
    session.replace(initial);
    const selectedNode: GeneratedMapNode = {
      key: "1-1",
      parentKey: "start",
      round: 1,
      choice: 1,
      type: "combat",
      icon: "test",
      iconType: "emoji",
      nextNodeKeys: ["2-1"],
    };
    const victoryRun: RunState = {
      ...initial,
      runCurrency: 25,
      map: {
        ...initial.map,
        currentNodeId: selectedNode.key,
        currentRound: 2,
        choicePath: [selectedNode.choice],
        nodeStatuses: { [selectedNode.key]: "cleared", "2-1": "available" },
      },
    };
    const route: CombatOutcomeRoute = {
      applied: true,
      runState: victoryRun,
      sceneKey: SCENE_KEYS.reward,
      payload: {
        runState: victoryRun,
        rewardEquipmentIds: ["reward-a", "reward-b"],
      },
    };

    expect(persistCombatRunTransition(route, {
      node: selectedNode,
      nextNodeIds: selectedNode.nextNodeKeys,
    }, session)).toBe(true);
    expect(new RunSession(storage).restore()?.runCurrency).toBe(25);
    expect(session.getCheckpoint()).toMatchObject({
      sceneKey: SCENE_KEYS.reward,
      rewardEquipmentIds: ["reward-a", "reward-b"],
    });
  });
});
