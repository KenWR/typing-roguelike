import { describe, expect, test } from "bun:test";
import {
  RUN_STATE_SCHEMA_VERSION,
  beginMapNode,
  completeMapNode,
  type RunState,
  type ShopOffer,
} from "@typing-roguelike/shared";
import { applyRestNodeRecovery, completeRestNode, createRestNodeFlow } from "../src/game/rest/rest-node-flow";
import { createShopNodeFlow, purchaseShopOffer } from "../src/game/shop/shop-node-flow";

const run = (overrides: Partial<RunState> = {}): RunState => ({
  schemaVersion: RUN_STATE_SCHEMA_VERSION,
  status: "active",
  character: { currentHp: 90, maxHp: 100 },
  runCurrency: 100,
  acquiredItemValue: 0,
  inventory: { itemInstances: [], relicInstances: [] },
  loadout: { weaponId: null, subweaponId: null, ring1Id: null, ring2Id: null },
  build: { equippedRelicIds: [] },
  map: {
    mapId: "map",
    seed: 1,
    currentNodeId: "start",
    currentRound: 1,
    choicePath: [],
    nodeStatuses: {},
  },
  ...overrides,
});

const offer: ShopOffer = { id: "offer", kind: "equipment", itemId: "ember-blade", price: 25 };

describe("core map/shop/rest rules", () => {
  test("map selection keeps competing nodes available until completion locks them and unlocks next exactly once", () => {
    const map = {
      ...run().map,
      nodeStatuses: { a: "available" as const, b: "available" as const, next: "locked" as const },
    };
    const begun = beginMapNode(map, "a");
    expect(begun.nodeStatuses.a).toBe("available");
    expect(begun.nodeStatuses.b).toBe("available");
    expect(begun.nodeStatuses.next).toBe("locked");

    const first = completeMapNode(begun, "a", ["next"]);
    expect(first.applied).toBe(true);
    expect(first.map.nodeStatuses.a).toBe("cleared");
    expect(first.map.nodeStatuses.b).toBe("locked");
    expect(first.map.nodeStatuses.next).toBe("available");
    const duplicate = completeMapNode(first.map, "a", ["next"]);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.map).toBe(first.map);
  });

  test("shop rejects insufficient currency and duplicate purchase while normal purchase applies once", () => {
    const poor = run({ runCurrency: 10 });
    const rejected = purchaseShopOffer(createShopNodeFlow(poor, "shop", [], [offer]), offer.id);
    expect(rejected.runState).toBe(poor);
    expect(rejected.runState.runCurrency).toBe(10);
    expect(rejected.runState.inventory.itemInstances).toEqual([]);

    const enough = run({ runCurrency: 100 });
    const first = purchaseShopOffer(createShopNodeFlow(enough, "shop", [], [offer]), offer.id);
    expect(first.runState.runCurrency).toBe(75);
    expect(first.runState.inventory.itemInstances).toEqual(["ember-blade"]);
    const duplicate = purchaseShopOffer(first, offer.id);
    expect(duplicate.runState).toBe(first.runState);
    expect(duplicate.runState.runCurrency).toBe(75);
    expect(duplicate.runState.inventory.itemInstances).toEqual(["ember-blade"]);
  });

  test("rest recovery is capped at max hp and the same rest result applies only once", () => {
    const resting = run({
      character: { currentHp: 90, maxHp: 100 },
      map: { ...run().map, currentNodeId: "rest", nodeStatuses: { rest: "in_progress", next: "locked" } },
    });
    const first = applyRestNodeRecovery(createRestNodeFlow(resting, "rest", ["next"]), 25);
    expect(first.runState.character.currentHp).toBe(100);
    const duplicate = applyRestNodeRecovery(first, 25);
    expect(duplicate.runState.character.currentHp).toBe(100);

    const completed = completeRestNode(duplicate);
    expect(completed.runState.map.nodeStatuses.rest).toBe("cleared");
    expect(completed.runState.map.nodeStatuses.next).toBe("available");
    expect(completeRestNode(completed)).toBe(completed);
  });
});
