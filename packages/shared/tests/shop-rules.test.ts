import { describe, expect, test } from "bun:test";
import type { EquipmentConfig } from "../src/content/types.ts";
import { createInitialRunState } from "../src/contracts/backend/run-state.ts";
import { applyShopPurchase, createShopOffers, exitShop } from "../src/rules/shop-rules.ts";

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
			{ id: "shop-offer-1-sword-a", equipmentId: "sword-a", price: 10 },
			{ id: "shop-offer-2-sword-b", equipmentId: "sword-b", price: 30 },
		]);
	});

	test("atomically deducts currency and adds purchased equipment", () => {
		const runState = { ...createInitialRunState({ seed: 11 }), runCurrency: 80 };
		const offer = { id: "offer-a", equipmentId: "sword-a", price: 35 } as const;
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
		const offer = { id: "offer-a", equipmentId: "sword-a", price: 35 } as const;
		const result = applyShopPurchase({ offerId: offer.id, offers: [offer], runState });

		expect(result).toMatchObject({ applied: false, reason: "insufficient_currency" });
		expect(result.runState).toBe(runState);
		expect(result.purchasedOfferIds.size).toBe(0);
	});

	test("prevents purchasing the same offer twice", () => {
		const runState = { ...createInitialRunState({ seed: 11 }), runCurrency: 80 };
		const offer = { id: "offer-a", equipmentId: "sword-a", price: 35 } as const;
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
		const offer = { id: "offer-a", equipmentId: "sword-a", price: 35 } as const;
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
