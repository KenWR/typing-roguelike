import { EQUIPMENT_CONFIGS } from "../content/equipment.ts";
import type { EquipmentConfig } from "../content/types.ts";
import type { RunState } from "../contracts/backend/run-state.ts";

export type ShopOffer = Readonly<{
	id: string;
	equipmentId: string;
	price: number;
}>;

export type CreateShopOffersInput = Readonly<{
	count?: number;
	priceMultiplier?: number;
	minimumPrice?: number;
	random?: () => number;
	equipment?: readonly EquipmentConfig[];
}>;

export type ShopPurchaseResult = Readonly<{
	applied: boolean;
	reason: "purchased" | "already_purchased" | "insufficient_currency";
	offer: ShopOffer;
	beforeCurrency: number;
	afterCurrency: number;
	runState: RunState;
	purchasedOfferIds: ReadonlySet<string>;
}>;

export type ApplyShopPurchaseInput = Readonly<{
	offerId: string;
	offers: readonly ShopOffer[];
	runState: RunState;
	purchasedOfferIds?: ReadonlySet<string>;
}>;

const validateNonNegativeInteger = (name: string, value: number): number => {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError(`${name} must be a non-negative safe integer.`);
	}
	return value;
};

const validatePositiveNumber = (name: string, value: number): number => {
	if (!Number.isFinite(value) || value <= 0) {
		throw new RangeError(`${name} must be a finite positive number.`);
	}
	return value;
};

const getRandomIndex = (length: number, random: () => number): number => {
	const value = random();
	if (!Number.isFinite(value) || value < 0 || value >= 1) {
		throw new RangeError("Shop random value must be in [0, 1).");
	}
	return Math.floor(value * length);
};

export const createShopOffers = ({
	count = 3,
	priceMultiplier = 2,
	minimumPrice = 1,
	random = Math.random,
	equipment = EQUIPMENT_CONFIGS,
}: CreateShopOffersInput = {}): readonly ShopOffer[] => {
	validateNonNegativeInteger("Shop offer count", count);
	validatePositiveNumber("Shop price multiplier", priceMultiplier);
	validateNonNegativeInteger("Shop minimum price", minimumPrice);

	const available = [...new Map(
		equipment
			.filter(({ rarity }) => rarity !== "hidden")
			.map((item) => [item.id, item] as const),
	).values()];
	const offers: ShopOffer[] = [];
	while (offers.length < count && available.length > 0) {
		const equipmentIndex = getRandomIndex(available.length, random);
		const selected = available.splice(equipmentIndex, 1)[0]!;
		const price = Math.max(minimumPrice, Math.ceil(selected.sellValue * priceMultiplier));
		offers.push({
			id: `shop-offer-${offers.length + 1}-${selected.id}`,
			equipmentId: selected.id,
			price,
		});
	}
	return offers;
};

export const applyShopPurchase = ({
	offerId,
	offers,
	runState,
	purchasedOfferIds = new Set<string>(),
}: ApplyShopPurchaseInput): ShopPurchaseResult => {
	if (runState.status !== "active") {
		throw new Error("Shop purchases can only be applied to an active run.");
	}
	validateNonNegativeInteger("Run currency", runState.runCurrency);

	const normalizedOfferId = offerId.trim();
	const offer = offers.find(({ id }) => id === normalizedOfferId);
	if (!offer) throw new RangeError(`Unknown shop offer: ${normalizedOfferId}`);
	validateNonNegativeInteger("Shop offer price", offer.price);

	const beforeCurrency = runState.runCurrency;
	if (purchasedOfferIds.has(normalizedOfferId)) {
		return {
			applied: false,
			reason: "already_purchased",
			offer,
			beforeCurrency,
			afterCurrency: beforeCurrency,
			runState,
			purchasedOfferIds,
		};
	}
	if (beforeCurrency < offer.price) {
		return {
			applied: false,
			reason: "insufficient_currency",
			offer,
			beforeCurrency,
			afterCurrency: beforeCurrency,
			runState,
			purchasedOfferIds,
		};
	}

	const nextPurchasedOfferIds = new Set(purchasedOfferIds);
	nextPurchasedOfferIds.add(normalizedOfferId);
	const afterCurrency = beforeCurrency - offer.price;
	return {
		applied: true,
		reason: "purchased",
		offer,
		beforeCurrency,
		afterCurrency,
		runState: {
			...runState,
			runCurrency: afterCurrency,
			inventory: {
				...runState.inventory,
				itemInstances: [...runState.inventory.itemInstances, offer.equipmentId],
			},
		},
		purchasedOfferIds: nextPurchasedOfferIds,
	};
};

export const exitShop = (runState: RunState): RunState => runState;
