import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS } from "@typing-roguelike/shared";
import {
  formatShopOfferLabel,
  getShopOfferDisplayName,
} from "../src/game/shop/shop-offer-label";

describe("shop offer labels", () => {
  test("uses the localized equipment content name instead of the internal id", () => {
    const equipment = EQUIPMENT_CONFIGS.find((entry) => entry.id === "equipment_blood_sword") ?? EQUIPMENT_CONFIGS[0]!;

    expect(getShopOfferDisplayName(equipment.id)).toBe(equipment.name);
    expect(formatShopOfferLabel({ equipmentId: equipment.id, price: 120 })).toBe(`${equipment.name} · 120`);
    expect(formatShopOfferLabel({ equipmentId: equipment.id, price: 120 })).not.toContain(equipment.id);
  });

  test("uses a safe Korean fallback for an unknown equipment id", () => {
    expect(getShopOfferDisplayName("equipment_missing")).toBe("알 수 없는 장비");
    expect(formatShopOfferLabel({ equipmentId: "equipment_missing", price: 50 })).toBe("알 수 없는 장비 · 50");
  });
});
