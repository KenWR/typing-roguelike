import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS, RELIC_CONFIGS } from "@typing-roguelike/shared";
import {
  formatShopOfferLabel,
  getShopOfferDisplayName,
  getShopOfferKindLabel,
} from "../src/game/shop/shop-offer-label";

describe("shop offer labels", () => {
  test("uses the localized equipment content name instead of the internal id", () => {
    const equipment = EQUIPMENT_CONFIGS.find((entry) => entry.id === "equipment_blood_sword") ?? EQUIPMENT_CONFIGS[0]!;
    const offer = { kind: "equipment", itemId: equipment.id, price: 120 } as const;

    expect(getShopOfferDisplayName(offer)).toBe(equipment.name);
    expect(formatShopOfferLabel(offer)).toBe(`[장비] ${equipment.name} · 120`);
    expect(formatShopOfferLabel(offer)).not.toContain(equipment.id);
  });

  test("uses the localized relic content name", () => {
    const relic = RELIC_CONFIGS[0]!;
    const offer = { kind: "relic", itemId: relic.id, price: 90 } as const;

    expect(getShopOfferDisplayName(offer)).toBe(relic.name);
    expect(formatShopOfferLabel(offer)).toBe(`[유물] ${relic.name} · 90`);
    expect(formatShopOfferLabel(offer)).not.toContain(relic.id);
  });

  test("distinguishes equipment and relic rows", () => {
    expect(getShopOfferKindLabel({ kind: "equipment" })).toBe("장비");
    expect(getShopOfferKindLabel({ kind: "relic" })).toBe("유물");
  });

  test("uses a safe Korean fallback for unknown ids", () => {
    expect(getShopOfferDisplayName({ kind: "equipment", itemId: "equipment_missing" })).toBe("알 수 없는 장비");
    expect(getShopOfferDisplayName({ kind: "relic", itemId: "relic_missing" })).toBe("알 수 없는 유물");
    expect(formatShopOfferLabel({ kind: "equipment", itemId: "equipment_missing", price: 50 })).toBe("[장비] 알 수 없는 장비 · 50");
  });
});
