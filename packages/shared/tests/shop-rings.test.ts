import { describe, expect, test } from "bun:test";
import { RING_CONFIGS } from "../src/content/rings.ts";
import { createInitialRunState } from "../src/contracts/backend/run-state.ts";
import { getRingPrice } from "../src/rules/ring-drops.ts";
import {
  applyShopPurchase,
  createShopOffers,
  findShopOfferRing,
} from "../src/rules/shop-rules.ts";

describe("shop ring offers", () => {
  test("keeps rings opt-in for the shared offer generator", () => {
    const legacyDefault = createShopOffers({
      count: 0,
      relicCount: 0,
      random: () => 0,
    });
    expect(legacyDefault).toEqual([]);

    const rings = createShopOffers({
      count: 0,
      relicCount: 0,
      ringCount: 2,
      random: () => 0,
    });
    expect(rings).toHaveLength(2);
    expect(rings.every((offer) => offer.kind === "ring")).toBe(true);
    expect(new Set(rings.map((offer) => offer.itemId)).size).toBe(2);
  });

  test("prices and resolves ring offers from the shared ring registry", () => {
    const offer = createShopOffers({
      count: 0,
      relicCount: 0,
      ringCount: 1,
      random: () => 0,
    })[0]!;
    const ring = findShopOfferRing(offer)!;

    expect(ring).toBe(RING_CONFIGS[0]);
    expect(offer.price).toBe(getRingPrice(ring));
  });

  test("buying a ring charges once, stores it, and equips the first empty ring slot", () => {
    const ring = RING_CONFIGS[0]!;
    const runState = { ...createInitialRunState({ seed: 343 }), runCurrency: 500 };
    const offer = {
      id: "offer-ring",
      kind: "ring",
      itemId: ring.id,
      price: getRingPrice(ring),
    } as const;

    const purchased = applyShopPurchase({ offerId: offer.id, offers: [offer], runState });
    expect(purchased.applied).toBe(true);
    expect(purchased.afterCurrency).toBe(500 - offer.price);
    expect(purchased.runState.inventory.itemInstances).toContain(ring.id);
    expect(purchased.runState.loadout.ring1Id).toBe(ring.id);
    expect(purchased.runState.loadout.ring2Id).toBeNull();

    const again = applyShopPurchase({
      offerId: offer.id,
      offers: [offer],
      runState: purchased.runState,
      purchasedOfferIds: purchased.purchasedOfferIds,
    });
    expect(again.applied).toBe(false);
    expect(again.reason).toBe("already_purchased");
    expect(again.afterCurrency).toBe(purchased.afterCurrency);
  });

  test("never lists explicitly excluded owned rings", () => {
    const owned = RING_CONFIGS.slice(0, 3).map((ring) => ring.id);
    const offers = createShopOffers({
      count: 0,
      relicCount: 0,
      ringCount: 3,
      excludedRingIds: owned,
      random: () => 0,
    });
    for (const offer of offers) expect(owned).not.toContain(offer.itemId);
  });
});
