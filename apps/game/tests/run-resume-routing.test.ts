import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
  generateNodeChoices,
  type GeneratedMapNode,
  type RunState,
  type ShopOffer,
} from "@typing-roguelike/shared";
import { resolveRunResumeRoute } from "../src/game/run/run-resume-routing";
import {
  RUN_RESUME_CHECKPOINT_VERSION,
  type RunResumeCheckpoint,
} from "../src/game/run/run-resume-checkpoint";
import { initializeRunMap } from "../src/game/run/run-start-map";
import { SCENE_KEYS } from "../src/game/scenes/scene-contract";

const node = (type: GeneratedMapNode["type"]): GeneratedMapNode => ({
  key: "1-1",
  parentKey: "start",
  round: 1,
  choice: 1,
  type,
  icon: "test",
  iconType: "emoji",
  nextNodeKeys: ["2-1"],
});

const activeAtNode = (selected: GeneratedMapNode): RunState => {
  const initial = initializeRunMap(createInitialRunState({ seed: 55 }));
  return {
    ...initial,
    map: {
      ...initial.map,
      currentNodeId: selected.key,
      nodeStatuses: { [selected.key]: "in_progress", "1-2": "locked" },
    },
  };
};

const checkpoint = (
  selected: GeneratedMapNode,
  sceneKey: RunResumeCheckpoint["sceneKey"],
  extra: Partial<RunResumeCheckpoint> = {},
): RunResumeCheckpoint => ({
  version: RUN_RESUME_CHECKPOINT_VERSION,
  sceneKey,
  node: selected,
  nextNodeIds: selected.nextNodeKeys,
  ...extra,
});

describe("run resume routing", () => {
  test("returns to map and restores a legacy in-progress node to available", () => {
    const initial = createInitialRunState({ seed: 7 });
    const runState = { ...initial, map: { ...initial.map, currentNodeId: "1-1", nodeStatuses: { ...initial.map.nodeStatuses, "1-1": "in_progress" as const } } };
    const route = resolveRunResumeRoute(runState, null);
    expect(route.sceneKey).toBe(SCENE_KEYS.map);
    expect(route.recovered).toBe(true);
    expect((route.payload.runState as typeof runState).map.nodeStatuses["1-1"]).toBe("available");
  });

  test("keeps a normal active map state unchanged", () => {
    const runState = createInitialRunState({ seed: 8 });
    const route = resolveRunResumeRoute(runState, null);
    expect(route.sceneKey).toBe(SCENE_KEYS.map);
    expect(route.recovered).toBe(false);
    expect(route.payload.runState).toBe(runState);
  });

  test("resumes a shop with its exact offers, purchases, and reroll count", () => {
    const selected = node("shop");
    const runState = activeAtNode(selected);
    const offers: ShopOffer[] = [{ id: "offer-1", equipmentId: "iron_sword", price: 20 }];
    const route = resolveRunResumeRoute(runState, checkpoint(selected, SCENE_KEYS.shop, {
      shopOffers: offers,
      purchasedOfferIds: ["offer-1"],
      shopRerollCount: 2,
    }));

    expect(route.sceneKey).toBe(SCENE_KEYS.shop);
    expect(route.payload.offers).toEqual(offers);
    expect(route.payload.purchasedOfferIds).toEqual(["offer-1"]);
    expect(route.payload.rerollCount).toBe(2);
  });

  test("resumes the selected rest node instead of exposing sibling branches", () => {
    const selected = node("rest");
    const runState = activeAtNode(selected);
    const route = resolveRunResumeRoute(
      runState,
      checkpoint(selected, SCENE_KEYS.rest),
    );

    expect(route.sceneKey).toBe(SCENE_KEYS.rest);
    expect(route.payload.nodeId).toBe(selected.key);
    expect(runState.map.nodeStatuses["1-2"]).toBe("locked");
  });

  test("rebuilds a combat encounter for a valid combat checkpoint", () => {
    let runState!: RunState;
    let selected!: GeneratedMapNode;
    for (let seed = 0; seed < 100 && selected === undefined; seed += 1) {
      const candidateRun = initializeRunMap(createInitialRunState({ seed }));
      const candidate = generateNodeChoices(seed, 1, []).find((entry) =>
        entry.type === "combat" || entry.type === "elite"
      );
      if (candidate !== undefined) {
        selected = candidate;
        runState = {
          ...candidateRun,
          map: {
            ...candidateRun.map,
            currentNodeId: candidate.key,
            nodeStatuses: { [candidate.key]: "in_progress" },
          },
        };
      }
    }

    const route = resolveRunResumeRoute(
      runState,
      checkpoint(selected, SCENE_KEYS.combat),
    );
    expect(route.sceneKey).toBe(SCENE_KEYS.combat);
    expect(route.payload.combat).toBeDefined();
  });

  test("resumes an unclaimed combat reward with the original candidates", () => {
    const selected = node("combat");
    const runState: RunState = {
      ...activeAtNode(selected),
      map: {
        ...activeAtNode(selected).map,
        currentRound: 2,
        choicePath: [selected.choice],
        nodeStatuses: { [selected.key]: "cleared", "2-1": "available" },
      },
    };
    const rewardEquipmentIds = EQUIPMENT_CONFIGS.slice(0, 3).map(({ id }) => id);
    const route = resolveRunResumeRoute(runState, checkpoint(selected, SCENE_KEYS.reward, {
      rewardEquipmentIds,
    }));
    const adapter = route.payload.adapter as {
      getViewState: () => { candidates: readonly { id: string }[] };
    };

    expect(route.sceneKey).toBe(SCENE_KEYS.reward);
    expect(adapter.getViewState().candidates.map(({ id }) => id)).toEqual(rewardEquipmentIds);
  });

  test("restores a pending terminal run directly to its result", () => {
    const dead: RunState = { ...createInitialRunState({ seed: 99 }), status: "dead" };
    const route = resolveRunResumeRoute(dead, null);

    expect(route.sceneKey).toBe(SCENE_KEYS.runResult);
    expect(route.payload.result).toBe("death");
  });
});
