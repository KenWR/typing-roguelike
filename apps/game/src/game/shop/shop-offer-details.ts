import {
  EQUIPMENT_CONFIGS,
  RELIC_CONFIGS,
  type ShopOffer,
} from "@typing-roguelike/shared";
import { getRelicIconTextureKey } from "../assets/asset-catalog";
import { resolveEquipmentIconTextureKey } from "../assets/equipment-icon-assets";

export type ShopOfferHoverDetails = Readonly<{
  name: string;
  kindLabel: "유물" | "장비";
  rarity: string;
  description: string;
  textureKey?: string;
}>;

const equipmentById = new Map(
  EQUIPMENT_CONFIGS.map((equipment) => [equipment.id, equipment] as const),
);
const relicById = new Map(RELIC_CONFIGS.map((relic) => [relic.id, relic] as const));

const formatEquipmentDescription = (
  equipment: (typeof EQUIPMENT_CONFIGS)[number],
): string =>
  equipment.skills
    .map(
      (skill) =>
        `${skill.name} · ${skill.command}\n${skill.description}`,
    )
    .join("\n\n");

export const getShopOfferHoverDetails = (
  offer: Pick<ShopOffer, "kind" | "itemId">,
): ShopOfferHoverDetails => {
  if (offer.kind === "relic") {
    const relic = relicById.get(offer.itemId);
    return {
      name: relic?.name ?? "알 수 없는 유물",
      kindLabel: "유물",
      rarity: relic?.rarity ?? "unknown",
      description: relic?.description ?? "설명 정보가 없습니다.",
      textureKey: relic === undefined ? undefined : getRelicIconTextureKey(relic.id),
    };
  }

  const equipment = equipmentById.get(offer.itemId);
  return {
    name: equipment?.name ?? "알 수 없는 장비",
    kindLabel: "장비",
    rarity: equipment?.rarity ?? "unknown",
    description:
      equipment === undefined
        ? "설명 정보가 없습니다."
        : formatEquipmentDescription(equipment),
    textureKey:
      equipment === undefined
        ? undefined
        : resolveEquipmentIconTextureKey(equipment.id),
  };
};
