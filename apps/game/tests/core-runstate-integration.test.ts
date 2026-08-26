import { describe, expect, test } from "bun:test";
import { createInitialRunState, generateNodeChoices, type RunState } from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { finalizeCombatOutcome } from "../src/game/combat/combat-outcome-routing";
import { RunSession } from "../src/game/run/run-session";
import { routeMapNodeSelection } from "../src/game/run/map-node-routing";
import { SettlementCompletionController } from "../src/game/settlement/settlement-completion";
import { completeRestNode, createRestNodeFlow } from "../src/game/rest/rest-node-flow";
import { completeShopNode, createShopNodeFlow } from "../src/game/shop/shop-node-flow";
import { SCENE_KEYS } from "../src/game/scenes/scene-contract";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

const firstNodeRun = (): { run: RunState; nodeId: string } => {
  const run = createInitialRunState({ seed: 17 });
  const nodes = generateNodeChoices(run.map.seed, 1, []);
  const node = nodes[0]!;
  return {
    nodeId: node.key,
    run: { ...run, map: { ...run.map, nodeStatuses: Object.fromEntries(nodes.map((item) => [item.key, "available" as const])) } },
  };
};

describe("core RunState integration", () => {
  test("run session survives map selection and combat victory without replacing run data", () => {
    const storage = memoryStorage();
    const session = new RunSession(storage);
    const created = session.create({ seed: 17 });
    const nodes = generateNodeChoices(created.map.seed, 1, []);
    session.update((run) => ({ ...run, map: { ...run.map, nodeStatuses: Object.fromEntries(nodes.map((node) => [node.key, "available" as const])) } }));

    const selectable = nodes.find((node) => node.type === "combat" || node.type === "elite") ?? nodes[0]!;
    const route = routeMapNodeSelection(session.require(), selectable.key);
    expect(route.applied).toBe(true);
    session.update(() => route.runState);

    if (route.sceneKey === SCENE_KEYS.combat) {
      const outcome = finalizeCombatOutcome({
        combat: new CombatState(),
        enemyTimeline: new EnemyAttackTimeline(),
        runState: route.runState,
        outcome: "victory",
        nextNodeIds: selectable.nextNodeKeys,
      });
      expect(outcome.sceneKey).toBe(SCENE_KEYS.map);
      expect(outcome.runState.map.seed).toBe(17);
      expect(outcome.runState.status).toBe("active");
    }
  });

  test("shop and rest completion preserve RunState and return to the map contract", () => {
    const { run } = firstNodeRun();
    const shopRun: RunState = { ...run, map: { ...run.map, currentNodeId: "shop", nodeStatuses: { shop: "in_progress", next: "locked" } } };
    const shop = completeShopNode(createShopNodeFlow(shopRun, "shop", ["next"], []));
    expect(shop.runState.map.nodeStatuses.shop).toBe("cleared");
    expect(shop.runState.map.nodeStatuses.next).toBe("available");
    expect(shop.runState.map.seed).toBe(run.map.seed);

    const restRun: RunState = { ...shop.runState, map: { ...shop.runState.map, currentNodeId: "rest", nodeStatuses: { rest: "in_progress", next2: "locked" } } };
    const rest = completeRestNode(createRestNodeFlow(restRun, "rest", ["next2"]));
    expect(rest.runState.map.nodeStatuses.rest).toBe("cleared");
    expect(rest.runState.map.nodeStatuses.next2).toBe("available");
    expect(rest.runState.map.seed).toBe(run.map.seed);
  });

  test("defeat ends the run and settlement confirmation clears the session exactly once", () => {
    const storage = memoryStorage();
    const session = new RunSession(storage);
    const active = session.create({ seed: 9 });
    const fighting: RunState = { ...active, map: { ...active.map, currentNodeId: "fight", nodeStatuses: { fight: "in_progress" } } };
    const defeat = finalizeCombatOutcome({
      combat: new CombatState(),
      enemyTimeline: new EnemyAttackTimeline(),
      runState: fighting,
      outcome: "defeat",
    });
    expect(defeat.sceneKey).toBe(SCENE_KEYS.runResult);
    expect(defeat.runState.status).toBe("dead");

    const settlement = new SettlementCompletionController(defeat.runState, session);
    expect(settlement.confirm().applied).toBe(true);
    expect(session.get()).toBeNull();
    expect(settlement.confirm().applied).toBe(false);
  });
});
