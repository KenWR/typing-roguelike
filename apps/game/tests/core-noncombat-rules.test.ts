import { describe, expect, test } from "bun:test";
import {
  RUN_STATE_SCHEMA_VERSION,
  applyRestRecovery,
  applyShopPurchase,
  beginMapNode,
  completeMapNode,
  type RunState,
  type ShopOffer,
} from "@typing-roguelike/shared";

const createRun = ({
  currentHp = 40,
  maxHp = 100,
  runCurrency = 100,
}: {
  currentHp?: number;
  maxHp?: number;
  runCurrency?: number;
} = {}): RunState => ({
  schemaVersion: RUN_STATE_SCHEMA_VERSION,
  status: "active",
  character: { currentHp, maxHp },
  runCurrency,
  acquiredItemValue: 0,
  inventory: { itemInstances: [], relicInstances: [] },
  loadout: {
    weaponId: null,
    subweaponId: null,
    ring1Id: null,
    ring2Id: null,
  },
  build: { equippedRelicIds: [] },
  map: {
    mapId: "qa-map",
    seed: 1,
    currentNodeId: null,
    currentRound: 1,
    choicePath: [],
    nodeStatuses: {
      start: "available",
      sibling: "available",
      next: "locked",
    },
  },
});

const shopOffer: ShopOffer = {
  id: "qa-offer",
  kind: "equipment" as const,
  itemId: "qa-equipment",
  price: 25,
};

describe("CORE-10-03 non-combat domain rules", () => {
  test("selecting a node locks siblings until completion unlocks the next node", () => {
    const run = createRun();
    const begun = beginMapNode(run.map, "start");

    expect(begun.currentNodeId).toBe("start");
    expect(begun.nodeStatuses.start).toBe("in_progress");
    expect(begun.nodeStatuses.sibling).toBe("locked");
    expect(begun.nodeStatuses.next).toBe("locked");

    const completed = completeMapNode(begun, "start", ["next"]);

    expect(completed.applied).toBe(true);
    expect(completed.map.nodeStatuses.start).toBe("cleared");
    expect(completed.map.nodeStatuses.sibling).toBe("locked");
    expect(completed.map.nodeStatuses.next).toBe("available");
  });

  test("completing the same map node twice rejects the duplicate result", () => {
    const begun = beginMapNode(createRun().map, "start");
    const first = completeMapNode(begun, "start", ["next"]);
    const duplicate = completeMapNode(first.map, "start", ["next"]);

    expect(first.applied).toBe(true);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.map).toBe(first.map);
  });

  test("shop purchase succeeds exactly once and does not charge twice", () => {
    const before = createRun({ runCurrency: 100 });
    const first = applyShopPurchase({
      offerId: shopOffer.id,
      offers: [shopOffer],
      runState: before,
    });
    const duplicate = applyShopPurchase({
      offerId: shopOffer.id,
      offers: [shopOffer],
      runState: first.runState,
      purchasedOfferIds: first.purchasedOfferIds,
    });

    expect(first.applied).toBe(true);
    expect(first.reason).toBe("purchased");
    expect(first.runState.runCurrency).toBe(75);
    expect(first.runState.inventory.itemInstances).toEqual(["qa-equipment"]);

    expect(duplicate.applied).toBe(false);
    expect(duplicate.reason).toBe("already_purchased");
    expect(duplicate.runState.runCurrency).toBe(75);
    expect(duplicate.runState.inventory.itemInstances).toEqual(["qa-equipment"]);
  });

  test("shop purchase with insufficient currency leaves currency and inventory unchanged", () => {
    const before = createRun({ runCurrency: 10 });
    const result = applyShopPurchase({
      offerId: shopOffer.id,
      offers: [shopOffer],
      runState: before,
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("insufficient_currency");
    expect(result.runState.runCurrency).toBe(10);
    expect(result.runState.inventory.itemInstances).toEqual([]);
  });

  test("rest recovery caps at max HP and applies a result id only once", () => {
    const before = createRun({ currentHp: 90, maxHp: 100 });
    const first = applyRestRecovery({
      resultId: "rest:qa-map:rest-1",
      runState: before,
      config: { healAmount: 30 },
    });
    const duplicate = applyRestRecovery({
      resultId: "rest:qa-map:rest-1",
      runState: first.runState,
      config: { healAmount: 30 },
      appliedResultIds: first.appliedResultIds,
    });

    expect(first.applied).toBe(true);
    expect(first.afterHp).toBe(100);
    expect(first.healedAmount).toBe(10);
    expect(first.runState.character.currentHp).toBe(100);

    expect(duplicate.applied).toBe(false);
    expect(duplicate.healedAmount).toBe(0);
    expect(duplicate.runState.character.currentHp).toBe(100);
  });
});
