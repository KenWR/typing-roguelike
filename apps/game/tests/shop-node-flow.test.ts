import { describe, expect, test } from "bun:test";
import { RUN_STATE_SCHEMA_VERSION, type RunState, type ShopOffer } from "@typing-roguelike/shared";
import {
  completeShopNode,
  createShopNodeFlow,
  getShopRerollCost,
  purchaseShopOffer,
  rerollShopOffers,
} from "../src/game/shop/shop-node-flow";

const run = (): RunState => ({
  schemaVersion: RUN_STATE_SCHEMA_VERSION,
  status: "active",
  character: { currentHp: 80, maxHp: 100 },
  runCurrency: 100,
  acquiredItemValue: 0,
  inventory: { itemInstances: [], relicInstances: [] },
  loadout: { weaponId: null, subweaponId: null, ring1Id: null, ring2Id: null },
  build: { equippedRelicIds: [] },
  map: {
    mapId: "map",
    seed: 1,
    currentNodeId: "shop",
    currentRound: 1,
    choicePath: [],
    nodeStatuses: { shop: "in_progress", next: "locked" },
  },
});

const offers: readonly ShopOffer[] = [{ id: "offer", equipmentId: "equipment_blood_sword", price: 25 }];

describe("shop node flow", () => {
  test("purchase updates currency and inventory", () => {
    const next = purchaseShopOffer(createShopNodeFlow(run(), "shop", ["next"], offers), "offer");
    expect(next.runState.runCurrency).toBe(75);
    expect(next.runState.inventory.itemInstances).toContain("equipment_blood_sword");
    expect(next.runState.loadout.weaponId).toBe("equipment_blood_sword");
  });

  test("rejects purchasing equipment that is already owned", () => {
    const ownedRun = {
      ...run(),
      inventory: { itemInstances: ["equipment_blood_sword"], relicInstances: [] },
      loadout: { ...run().loadout, weaponId: "equipment_blood_sword" },
    };
    const state = createShopNodeFlow(ownedRun, "shop", ["next"], offers);
    const rejected = purchaseShopOffer(state, "offer");

    expect(rejected.runState).toBe(ownedRun);
    expect(rejected.runState.runCurrency).toBe(100);
    expect(rejected.runState.inventory.itemInstances).toEqual(["equipment_blood_sword"]);
    expect(rejected.purchasedOfferIds.has("offer")).toBe(false);
  });

  test("reroll spends increasing currency and replaces offers", () => {
    const initial = createShopNodeFlow(run(), "shop", ["next"], offers);
    expect(getShopRerollCost(initial)).toBe(10);

    const rerolled = rerollShopOffers(initial, () => 0);
    expect(rerolled.runState.runCurrency).toBe(90);
    expect(rerolled.rerollCount).toBe(1);
    expect(getShopRerollCost(rerolled)).toBe(20);
    expect(rerolled.offers.length).toBeGreaterThan(0);

    const rerolledAgain = rerollShopOffers(rerolled, () => 0);
    expect(rerolledAgain.runState.runCurrency).toBe(70);
    expect(rerolledAgain.rerollCount).toBe(2);
    expect(getShopRerollCost(rerolledAgain)).toBe(30);
  });

  test("reroll is rejected when currency is insufficient", () => {
    const poor = { ...run(), runCurrency: 5 };
    const state = createShopNodeFlow(poor, "shop", ["next"], offers);
    expect(rerollShopOffers(state, () => 0)).toBe(state);
  });

  test("rerolled offers exclude equipment already owned", () => {
    const ownedId = "equipment_blood_sword";
    const ownedRun = {
      ...run(),
      inventory: { itemInstances: [ownedId], relicInstances: [] },
    };
    const rerolled = rerollShopOffers(
      createShopNodeFlow(ownedRun, "shop", ["next"], offers),
      () => 0,
    );
    expect(rerolled.offers.some((offer) => offer.equipmentId === ownedId)).toBe(false);
  });

  test("exit clears node and unlocks next map node", () => {
    const next = completeShopNode(createShopNodeFlow(run(), "shop", ["next"], offers));
    expect(next.runState.map.nodeStatuses.shop).toBe("cleared");
    expect(next.runState.map.nodeStatuses.next).toBe("available");
    expect(next.completed).toBe(true);
  });
});
