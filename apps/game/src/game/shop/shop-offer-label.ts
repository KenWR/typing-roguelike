import {
  EQUIPMENT_CONFIGS,
  RELIC_CONFIGS,
  type ShopOffer,
} from "@typing-roguelike/shared";

const equipmentNameById = new Map<string, string>(
  EQUIPMENT_CONFIGS.map((equipment) => [equipment.id, equipment.name] as const),
);

const relicNameById = new Map<string, string>(
  RELIC_CONFIGS.map((relic) => [relic.id, relic.name] as const),
);

export const getShopOfferDisplayName = (
  offer: Pick<ShopOffer, "kind" | "itemId">,
): string =>
  offer.kind === "relic"
    ? relicNameById.get(offer.itemId) ?? "알 수 없는 유물"
    : equipmentNameById.get(offer.itemId) ?? "알 수 없는 장비";

/** 진열 목록에서 장비와 유물을 구분할 수 있게 종류를 함께 표시합니다. */
export const getShopOfferKindLabel = (
  offer: Pick<ShopOffer, "kind">,
): string => (offer.kind === "relic" ? "유물" : "장비");

export const formatShopOfferLabel = (
  offer: Pick<ShopOffer, "kind" | "itemId" | "price">,
): string =>
  `[${getShopOfferKindLabel(offer)}] ${getShopOfferDisplayName(offer)} · ${offer.price}`;
