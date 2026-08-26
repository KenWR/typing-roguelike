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

const offer: ShopOffer = { id: "offer", equipmentId: "ember-blade", price: 25 };

describe("core map/shop/rest rules", () => {
  test("map selection locks competing nodes and completion unlocks next exactly once", () => {
    const map = {
      ...run().map,
      nodeStatuses: { a: "available" as const, b: "available" as const, next: "locked" as const },
    };
    const begun = beginMapNode(map, "a");
    expect(begun.nodeStatuses.a).toBe("in_progress");
    expect(begun.nodeStatuses.b).toBe("locked");

    const first = completeMapNode(begun, "a", ["next"]);
    expect(first.applied).toBe(true);
    expect(first.map.nodeStatuses.a).toBe("cleared");
    expect(first.map.nodeStatuses.next).toBe("available");
    const duplicate = completeMapNode(first.map, "a", ["next"]);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.map).toBe(first.map);
  });

  test("shop rejects insufficient currency and duplicate purchase while normal purchase applies once", () => {
    const poor = run({ runCurrency: 10 });
    expect(() => purchaseShopOffer(createShopNodeFlow(poor, "shop", [], [offer]), offer.id)).toThrow();

    const enough = run({ runCurrency: 100 });
    const first = purchaseShopOffer(createShopNodeFlow(enough, "shop", [], [offer]), offer.id);
    expect(first.runState.runCurrency).toBe(75);
    expect(first.runState.inventory.itemInstances).toEqual(["ember-blade"]);
    expect(() => purchaseShopOffer(first, offer.id)).toThrow();
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
