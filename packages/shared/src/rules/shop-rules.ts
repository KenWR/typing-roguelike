import { EQUIPMENT_CONFIGS } from "../content/equipment.ts";
import { RELIC_CONFIGS } from "../content/relics.ts";
import { RING_CONFIGS } from "../content/rings.ts";
import type { EquipmentConfig, RelicConfig, RingConfig } from "../content/types.ts";
import type { RunState } from "../contracts/backend/run-state.ts";
import {
	applyRelicAcquisition,
	generateRelicRewardCandidates,
	getRelicPrice,
	ownsRelic,
} from "./relic-drops.ts";
import {
	applyRingAcquisition,
	generateRingRewardCandidates,
	getRingPrice,
	ownsRing,
} from "./ring-drops.ts";
import { applyEquipmentAcquisition } from "./equipment-loadout.ts";

export type ShopOfferKind = "equipment" | "relic" | "ring";

export type ShopOffer = Readonly<{
	id: string;
	kind: ShopOfferKind;
	/** kind 에 해당하는 장비, 유물 또는 반지의 ID */
	itemId: string;
	price: number;
}>;

/** kind 가 없던 시절의 진열 데이터. 저장된 체크포인트를 복원할 때만 등장합니다. */
export type LegacyShopOffer = Readonly<{
	id: string;
	equipmentId: string;
	price: number;
}>;

export const normalizeShopOffer = (
	offer: ShopOffer | LegacyShopOffer,
): ShopOffer =>
	"kind" in offer
		? offer
		: { id: offer.id, kind: "equipment", itemId: offer.equipmentId, price: offer.price };

export type CreateShopOffersInput = Readonly<{
	count?: number;
	relicCount?: number;
	ringCount?: number;
	priceMultiplier?: number;
	minimumPrice?: number;
	random?: () => number;
	equipment?: readonly EquipmentConfig[];
	excludedRelicIds?: readonly string[];
	excludedRingIds?: readonly string[];
}>;

export type ShopPurchaseResult = Readonly<{
	applied: boolean;
	reason:
		| "purchased"
		| "already_purchased"
		| "already_owned"
		| "insufficient_currency";
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
	relicCount = 2,
	ringCount = 0,
	priceMultiplier = 2,
	minimumPrice = 1,
	random = Math.random,
	equipment = EQUIPMENT_CONFIGS,
	excludedRelicIds = [],
	excludedRingIds = [],
}: CreateShopOffersInput = {}): readonly ShopOffer[] => {
	validateNonNegativeInteger("Shop offer count", count);
	validateNonNegativeInteger("Shop relic offer count", relicCount);
	validateNonNegativeInteger("Shop ring offer count", ringCount);
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
			kind: "equipment",
			itemId: selected.id,
			price,
		});
	}

	const rings = generateRingRewardCandidates({
		count: ringCount,
		random,
		excludedRingIds,
	});
	for (const ring of rings) {
		offers.push({
			id: `shop-offer-${offers.length + 1}-${ring.id}`,
			kind: "ring",
			itemId: ring.id,
			price: Math.max(minimumPrice, getRingPrice(ring)),
		});
	}

	// 유물은 장비/반지 진열과 겹치지 않는 별도 칸을 차지합니다.
	const relics = generateRelicRewardCandidates({
		count: relicCount,
		random,
		excludedRelicIds,
	});
	for (const relic of relics) {
		offers.push({
			id: `shop-offer-${offers.length + 1}-${relic.id}`,
			kind: "relic",
			itemId: relic.id,
			price: Math.max(minimumPrice, getRelicPrice(relic)),
		});
	}

	return offers;
};

export const findShopOfferEquipment = (
	offer: ShopOffer,
): EquipmentConfig | undefined =>
	offer.kind === "equipment"
		? EQUIPMENT_CONFIGS.find((candidate) => candidate.id === offer.itemId)
		: undefined;

export const findShopOfferRelic = (offer: ShopOffer): RelicConfig | undefined =>
	offer.kind === "relic"
		? RELIC_CONFIGS.find((candidate) => candidate.id === offer.itemId)
		: undefined;

export const findShopOfferRing = (offer: ShopOffer): RingConfig | undefined =>
	offer.kind === "ring"
		? RING_CONFIGS.find((candidate) => candidate.id === offer.itemId)
		: undefined;

/** 진열된 상품을 이미 보유하고 있는지 판단합니다. */
export const ownsShopOffer = (
	runState: Readonly<RunState>,
	offer: ShopOffer,
): boolean => {
	if (offer.kind === "relic") return ownsRelic(runState, offer.itemId);
	if (offer.kind === "ring") return ownsRing(runState, offer.itemId);
	return runState.inventory.itemInstances.includes(offer.itemId);
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
	if (ownsShopOffer(runState, offer)) {
		return {
			applied: false,
			reason: "already_owned",
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

	if (offer.kind === "relic") {
		const acquired = applyRelicAcquisition(runState, offer.itemId);
		return {
			applied: true,
			reason: "purchased",
			offer,
			beforeCurrency,
			afterCurrency,
			runState: { ...acquired, runCurrency: afterCurrency },
			purchasedOfferIds: nextPurchasedOfferIds,
		};
	}

	if (offer.kind === "ring") {
		const acquired = applyRingAcquisition(runState, offer.itemId);
		return {
			applied: true,
			reason: "purchased",
			offer,
			beforeCurrency,
			afterCurrency,
			runState: { ...acquired, runCurrency: afterCurrency },
			purchasedOfferIds: nextPurchasedOfferIds,
		};
	}

	const equipment = EQUIPMENT_CONFIGS.find(
		(candidate) => candidate.id === offer.itemId,
	);
	const acquired = equipment === undefined
		? {
			...runState,
			inventory: {
				...runState.inventory,
				itemInstances: [...runState.inventory.itemInstances, offer.itemId],
			},
		}
		: applyEquipmentAcquisition(runState, equipment);
	return {
		applied: true,
		reason: "purchased",
		offer,
		beforeCurrency,
		afterCurrency,
    runState: {
      ...acquired,
      runCurrency: afterCurrency,
    },
		purchasedOfferIds: nextPurchasedOfferIds,
	};
};

export const exitShop = (runState: RunState): RunState => runState;
