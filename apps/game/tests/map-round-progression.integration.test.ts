import { describe, expect, test } from "bun:test";
import {
  beginMapNode,
  createInitialRunState,
  generateNodeChoices,
  type GeneratedMapNode,
  type RunState,
} from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { finalizeCombatOutcome } from "../src/game/combat/combat-outcome-routing";
import { completeRestNode, createRestNodeFlow } from "../src/game/rest/rest-node-flow";
import { createMapHudView } from "../src/game/run/map-hud-view";
import { routeMapNodeSelection } from "../src/game/run/map-node-routing";
import { completeShopNode, createShopNodeFlow } from "../src/game/shop/shop-node-flow";

const withAvailableRound = (
  seed: number,
  round: number,
  choicePath: readonly number[],
): { runState: RunState; nodes: GeneratedMapNode[] } => {
  const base = createInitialRunState({ seed });
  const nodes = generateNodeChoices(seed, round, choicePath);
  return {
    nodes,
    runState: {
      ...base,
      map: {
        ...base.map,
        currentRound: round,
        choicePath: [...choicePath],
        currentNodeId: round === 1 ? "start" : `${round - 1}-${choicePath.at(-1)}`,
        nodeStatuses: Object.fromEntries(nodes.map((node) => [node.key, "available" as const])),
      },
    },
  };
};

const findRoundWithNodeType = (
  nodeType: GeneratedMapNode["type"],
  round: number,
  choicePath: readonly number[],
): { runState: RunState; nodes: GeneratedMapNode[] } => {
  for (let seed = 0; seed < 1000; seed += 1) {
    const candidate = withAvailableRound(seed, round, choicePath);
    if (candidate.nodes.some((node) => node.type === nodeType)) return candidate;
  }
  throw new Error(`Could not find ${nodeType} node for round ${round}`);
};

const expectAdvancedMap = (
  runState: RunState,
  completedNode: GeneratedMapNode,
): void => {
  expect(runState.map.currentRound).toBe(completedNode.round + 1);
  expect(runState.map.choicePath).toEqual([
    ...completedNode.key.split("-").slice(1).map(Number),
  ]);
  expect(runState.map.nodeStatuses[completedNode.key]).toBe("cleared");

  const hud = createMapHudView(runState);
  const availableIds = hud.nodes
    .filter((node) => node.status === "available")
    .map((node) => node.id)
    .sort();
  expect(hud.floor).toBe(completedNode.round + 1);
  expect(availableIds).toEqual([...completedNode.nextNodeKeys].sort());
  expect(hud.nodes.find((node) => node.id === completedNode.key)?.status).toBe("cleared");
};

describe("map round progression after node completion", () => {
  test("REST completion advances once and shows only connected next-round nodes", () => {
    const { runState, nodes } = withAvailableRound(1, 1, []);
    const node = nodes.find((candidate) => candidate.type === "rest")!;
    const started: RunState = { ...runState, map: beginMapNode(runState.map, node.key) };

    const first = completeRestNode(createRestNodeFlow(started, node.key, node.nextNodeKeys));
    const second = completeRestNode(first);

    expect(second.runState).toBe(first.runState);
    expectAdvancedMap(first.runState, node);
  });

  test("SHOP completion advances to its connected next round", () => {
    const { runState, nodes } = findRoundWithNodeType("shop", 2, [1]);
    const node = nodes.find((candidate) => candidate.type === "shop")!;
    const started: RunState = { ...runState, map: beginMapNode(runState.map, node.key) };

    const completed = completeShopNode(createShopNodeFlow(started, node.key, node.nextNodeKeys, []));

    expectAdvancedMap(completed.runState, node);
  });

  test("REWARD selection completes the map node when continuing back to Map", () => {
    const { runState, nodes } = withAvailableRound(0, 1, []);
    const node = nodes.find((candidate) => candidate.type === "reward")!;
    const route = routeMapNodeSelection(runState, node.key);
    const adapter = route.payload.adapter as {
      getViewState: () => { candidates: readonly { id: string }[] };
      getRunState: () => RunState;
      selectReward: (id: string) => unknown;
      continue: () => unknown;
    };

    const rewardId = adapter.getViewState().candidates[0]!.id;
    adapter.selectReward(rewardId);
    adapter.continue();

    expectAdvancedMap(adapter.getRunState(), node);
  });

  test("normal COMBAT victory advances before reward routing", () => {
    const { runState, nodes } = withAvailableRound(0, 1, []);
    const node = nodes.find((candidate) => candidate.type === "combat")!;
    const started: RunState = { ...runState, map: beginMapNode(runState.map, node.key) };

    const outcome = finalizeCombatOutcome({
      combat: new CombatState(),
      enemyTimeline: new EnemyAttackTimeline(),
      runState: started,
      outcome: "victory",
      nextNodeIds: node.nextNodeKeys,
      rewardCount: 1,
      rewardRandom: () => 0,
    });

    expectAdvancedMap(outcome.runState, node);
  });
});
