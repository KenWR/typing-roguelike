import { EQUIPMENT_CONFIGS, type ShopOffer } from "@typing-roguelike/shared";

const equipmentNameById = new Map(
  EQUIPMENT_CONFIGS.map((equipment) => [equipment.id, equipment.name] as const),
);

export const getShopOfferDisplayName = (equipmentId: string): string =>
  equipmentNameById.get(equipmentId) ?? "알 수 없는 장비";

export const formatShopOfferLabel = (offer: Pick<ShopOffer, "equipmentId" | "price">): string =>
  `${getShopOfferDisplayName(offer.equipmentId)} · ${offer.price}`;
