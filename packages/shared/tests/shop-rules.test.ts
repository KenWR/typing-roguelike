import { describe, expect, test } from "bun:test";
import type { EquipmentConfig } from "../src/content/types.ts";
import { createInitialRunState } from "../src/contracts/backend/run-state.ts";
import { RELIC_CONFIGS } from "../src/content/relics.ts";
import { getRelicPrice } from "../src/rules/relic-drops.ts";
import {
	applyShopPurchase,
	createShopOffers,
	exitShop,
	normalizeShopOffer,
} from "../src/rules/shop-rules.ts";

const equipment = (id: string, sellValue: number, rarity: EquipmentConfig["rarity"] = "common"): EquipmentConfig => ({
	id,
	name: id,
	slot: "weapon",
	kind: "sword",
	rarity,
	sellValue,
	skills: [],
});

describe("shop rules", () => {
	test("creates unique equipment offers with data-configured prices", () => {
		const offers = createShopOffers({
			count: 2,
			relicCount: 0,
			priceMultiplier: 1.5,
			minimumPrice: 10,
			random: () => 0,
			equipment: [
				equipment("sword-a", 4),
				equipment("sword-a", 4),
				equipment("sword-b", 20),
				equipment("hidden", 100, "hidden"),
			],
		});

		expect(offers).toEqual([
			{ id: "shop-offer-1-sword-a", kind: "equipment", itemId: "sword-a", price: 10 },
			{ id: "shop-offer-2-sword-b", kind: "equipment", itemId: "sword-b", price: 30 },
		]);
	});

	test("atomically deducts currency and adds purchased equipment", () => {
		const runState = { ...createInitialRunState({ seed: 11 }), runCurrency: 80 };
		const offer = { id: "offer-a", kind: "equipment", itemId: "sword-a", price: 35 } as const;
		const result = applyShopPurchase({ offerId: offer.id, offers: [offer], runState });

		expect(result).toMatchObject({
			applied: true,
			reason: "purchased",
			beforeCurrency: 80,
			afterCurrency: 45,
		});
		expect(result.runState.runCurrency).toBe(45);
		expect(result.runState.inventory.itemInstances).toEqual(["sword-a"]);
		expect(runState.runCurrency).toBe(80);
		expect(runState.inventory.itemInstances).toEqual([]);
	});

	test("rejects insufficient currency without changing state", () => {
		const runState = { ...createInitialRunState({ seed: 11 }), runCurrency: 10 };
		const offer = { id: "offer-a", kind: "equipment", itemId: "sword-a", price: 35 } as const;
		const result = applyShopPurchase({ offerId: offer.id, offers: [offer], runState });

		expect(result).toMatchObject({ applied: false, reason: "insufficient_currency" });
		expect(result.runState).toBe(runState);
		expect(result.purchasedOfferIds.size).toBe(0);
	});

	test("prevents purchasing the same offer twice", () => {
		const runState = { ...createInitialRunState({ seed: 11 }), runCurrency: 80 };
		const offer = { id: "offer-a", kind: "equipment", itemId: "sword-a", price: 35 } as const;
		const first = applyShopPurchase({ offerId: offer.id, offers: [offer], runState });
		const duplicate = applyShopPurchase({
			offerId: offer.id,
			offers: [offer],
			runState: first.runState,
			purchasedOfferIds: first.purchasedOfferIds,
		});

		expect(duplicate).toMatchObject({ applied: false, reason: "already_purchased", afterCurrency: 45 });
		expect(duplicate.runState).toBe(first.runState);
		expect(duplicate.runState.inventory.itemInstances).toEqual(["sword-a"]);
	});

	test("rejects purchasing equipment that is already in the inventory", () => {
		const runState = {
			...createInitialRunState({ seed: 11 }),
			runCurrency: 80,
			inventory: { itemInstances: ["sword-a"], relicInstances: [] },
		};
		const offer = { id: "offer-a", kind: "equipment", itemId: "sword-a", price: 35 } as const;
		const result = applyShopPurchase({ offerId: offer.id, offers: [offer], runState });

		expect(result).toMatchObject({
			applied: false,
			reason: "already_owned",
			beforeCurrency: 80,
			afterCurrency: 80,
		});
		expect(result.runState).toBe(runState);
		expect(result.runState.inventory.itemInstances).toEqual(["sword-a"]);
	});

	test("leaves run state unchanged when exiting and rejects invalid input", () => {
		const runState = createInitialRunState({ seed: 11 });
		expect(exitShop(runState)).toBe(runState);
		expect(() => createShopOffers({ count: -1 })).toThrow(RangeError);
		expect(() => createShopOffers({ random: () => 1 })).toThrow(RangeError);
		expect(() => applyShopPurchase({ offerId: "missing", offers: [], runState })).toThrow(RangeError);
		expect(() => applyShopPurchase({
			offerId: "offer-a",
			offers: [{ id: "offer-a", equipmentId: "sword-a", price: 1 }],
			runState: { ...runState, status: "cleared" },
		})).toThrow(Error);
	});
});

describe("shop relic offers", () => {
	test("adds relic rows alongside the equipment rows", () => {
		const offers = createShopOffers({
			count: 3,
			relicCount: 2,
			random: () => 0,
			equipment: [equipment("sword-a", 4), equipment("sword-b", 20), equipment("sword-c", 30)],
		});

		expect(offers.filter((offer) => offer.kind === "equipment")).toHaveLength(3);
		expect(offers.filter((offer) => offer.kind === "relic")).toHaveLength(2);
		expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
	});

	test("prices relics from the rarity table instead of the equipment multiplier", () => {
		const offers = createShopOffers({
			count: 0,
			relicCount: 1,
			priceMultiplier: 99,
			random: () => 0,
		});
		const offer = offers[0]!;
		const relic = RELIC_CONFIGS.find((candidate) => candidate.id === offer.itemId)!;

		expect(offer.kind).toBe("relic");
		expect(offer.price).toBe(getRelicPrice(relic));
	});

	test("never lists a relic the run already owns", () => {
		const owned = RELIC_CONFIGS.slice(0, 40).map((relic) => relic.id);
		const offers = createShopOffers({
			count: 0,
			relicCount: 3,
			random: () => 0,
			excludedRelicIds: owned,
		});

		for (const offer of offers) expect(owned).not.toContain(offer.itemId);
	});

	test("buying a relic stores, equips, and charges exactly once", () => {
		const relic = RELIC_CONFIGS[0]!;
		const runState = { ...createInitialRunState({ seed: 41 }), runCurrency: 500 };
		const offer = {
			id: "offer-relic",
			kind: "relic",
			itemId: relic.id,
			price: getRelicPrice(relic),
		} as const;

		const result = applyShopPurchase({ offerId: offer.id, offers: [offer], runState });
		expect(result.applied).toBe(true);
		expect(result.afterCurrency).toBe(500 - offer.price);
		expect(result.runState.inventory.relicInstances).toEqual([relic.id]);
		expect(result.runState.build.equippedRelicIds).toEqual([relic.id]);

		const again = applyShopPurchase({
			offerId: offer.id,
			offers: [offer],
			runState: result.runState,
			purchasedOfferIds: result.purchasedOfferIds,
		});
		expect(again.applied).toBe(false);
		expect(again.reason).toBe("already_purchased");
		expect(again.runState.runCurrency).toBe(result.afterCurrency);
	});

	test("rejects a relic already owned and one the run cannot afford", () => {
		const relic = RELIC_CONFIGS[0]!;
		const offer = { id: "offer-relic", kind: "relic", itemId: relic.id, price: 90 } as const;

		const owned = applyShopPurchase({
			offerId: offer.id,
			offers: [offer],
			runState: {
				...createInitialRunState({ seed: 42 }),
				runCurrency: 500,
				inventory: { itemInstances: [], relicInstances: [relic.id] },
			},
		});
		expect(owned).toMatchObject({ applied: false, reason: "already_owned" });

		const broke = applyShopPurchase({
			offerId: offer.id,
			offers: [offer],
			runState: { ...createInitialRunState({ seed: 43 }), runCurrency: 10 },
		});
		expect(broke).toMatchObject({ applied: false, reason: "insufficient_currency" });
		expect(broke.runState.inventory.relicInstances).toEqual([]);
	});

	test("restores a shop offer saved before the kind field existed", () => {
		expect(normalizeShopOffer({ id: "legacy", equipmentId: "sword-a", price: 12 })).toEqual({
			id: "legacy",
			kind: "equipment",
			itemId: "sword-a",
			price: 12,
		});
		expect(
			normalizeShopOffer({ id: "new", kind: "relic", itemId: "relic-a", price: 90 }),
		).toEqual({ id: "new", kind: "relic", itemId: "relic-a", price: 90 });
	});
});
