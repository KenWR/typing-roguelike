import { describe, expect, test } from "bun:test";
import {
  RELIC_CONFIGS,
  RUN_STATE_SCHEMA_VERSION,
  type RunState,
  type ShopOffer,
} from "@typing-roguelike/shared";
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

const offers: readonly ShopOffer[] = [{ id: "offer", kind: "equipment", itemId: "equipment_blood_sword", price: 25 }];

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
    expect(rerolled.offers.some((offer) => offer.itemId === ownedId)).toBe(false);
  });

  test("exit clears node and unlocks next map node", () => {
    const next = completeShopNode(createShopNodeFlow(run(), "shop", ["next"], offers));
    expect(next.runState.map.nodeStatuses.shop).toBe("cleared");
    expect(next.runState.map.nodeStatuses.next).toBe("available");
    expect(next.completed).toBe(true);
  });
});

describe("shop node relic offers", () => {
  test("lists relics next to equipment and buys one without touching the loadout", () => {
    const runState = { ...run(), runCurrency: 500 };
    const flow = createShopNodeFlow(runState, "shop-node", ["next"]);
    const relicOffer = flow.offers.find((offer) => offer.kind === "relic");

    expect(flow.offers.some((offer) => offer.kind === "equipment")).toBe(true);
    expect(relicOffer).toBeDefined();

    const purchased = purchaseShopOffer(flow, relicOffer!.id);

    expect(purchased.runState.inventory.relicInstances).toEqual([relicOffer!.itemId]);
    expect(purchased.runState.build.equippedRelicIds).toEqual([relicOffer!.itemId]);
    expect(purchased.runState.loadout).toEqual(runState.loadout);
    expect(purchased.runState.runCurrency).toBe(500 - relicOffer!.price);
  });

  test("never lists an owned relic, even when almost every relic is owned", () => {
    // 후보가 거의 남지 않은 상태에서도 보유 유물이 새지 않아야 한다.
    const owned = RELIC_CONFIGS.slice(0, -2).map((relic) => relic.id);
    const runState: RunState = {
      ...run(),
      runCurrency: 5_000,
      inventory: { itemInstances: [], relicInstances: owned },
      build: { equippedRelicIds: owned },
    };

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const flow = createShopNodeFlow(runState, "shop-node", ["next"]);
      for (const offer of flow.offers) {
        if (offer.kind === "relic") expect(owned).not.toContain(offer.itemId);
      }
    }
  });

  test("drops a relic from the shelf once it has been bought and rerolled", () => {
    const first = createShopNodeFlow({ ...run(), runCurrency: 5_000 }, "shop-node", ["next"]);
    const relicOffer = first.offers.find((offer) => offer.kind === "relic")!;
    const purchased = purchaseShopOffer(first, relicOffer.id);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const rerolled = rerollShopOffers(purchased);
      expect(rerolled.offers.some((offer) => offer.itemId === relicOffer.itemId)).toBe(false);
    }
  });
});
