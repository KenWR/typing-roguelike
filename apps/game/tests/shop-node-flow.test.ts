import { describe, expect, test } from "bun:test";
import type { RunState, ShopOffer } from "@typing-roguelike/shared";
import { completeShopNode, createShopNodeFlow, purchaseShopOffer } from "../src/game/shop/shop-node-flow";

const run = (): RunState => ({
  status: "active",
  seed: 1,
  player: { currentHp: 80, maxHp: 100 },
  runCurrency: 100,
  acquiredItemValue: 0,
  inventory: { itemInstances: [], relicIds: [], equipment: { weaponId: null, subweaponId: null } },
  map: { mapId: "map", currentNodeId: "shop", nodeStatuses: { shop: "in_progress", next: "locked" } },
});

const offers: readonly ShopOffer[] = [{ id: "offer", equipmentId: "ember-blade", price: 25 }];

describe("shop node flow", () => {
  test("purchase updates currency and inventory", () => {
    const next = purchaseShopOffer(createShopNodeFlow(run(), "shop", ["next"], offers), "offer");
    expect(next.runState.runCurrency).toBe(75);
    expect(next.runState.inventory.itemInstances).toContain("ember-blade");
  });

  test("exit clears node and unlocks next map node", () => {
    const next = completeShopNode(createShopNodeFlow(run(), "shop", ["next"], offers));
    expect(next.runState.map.nodeStatuses.shop).toBe("cleared");
    expect(next.runState.map.nodeStatuses.next).toBe("available");
    expect(next.completed).toBe(true);
  });
});
