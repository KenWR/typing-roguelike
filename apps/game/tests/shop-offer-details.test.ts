import { describe, expect, test } from "bun:test";
import { getShopOfferHoverDetails } from "../src/game/shop/shop-offer-details";

describe("shop offer hover details", () => {
  test("returns relic image and description", () => {
    const details = getShopOfferHoverDetails({
      kind: "relic",
      itemId: "relic_steel_fragment",
    });

    expect(details.name).toBe("강철 조각");
    expect(details.kindLabel).toBe("유물");
    expect(details.description).toContain("방어력");
    expect(details.textureKey).toBe("relic-icon:relic_steel_fragment");
  });

  test("returns equipment skill description and mapped image", () => {
    const details = getShopOfferHoverDetails({
      kind: "equipment",
      itemId: "equipment_rusty_sword",
    });

    expect(details.kindLabel).toBe("장비");
    expect(details.name.length).toBeGreaterThan(0);
    expect(details.description.length).toBeGreaterThan(0);
    expect(details.textureKey).toBe("equipment-icon:equipment_rusty_sword");
  });

  test("keeps equipment without an icon usable", () => {
    const details = getShopOfferHoverDetails({
      kind: "equipment",
      itemId: "equipment_clear_crystal_orb",
    });

    expect(details.kindLabel).toBe("장비");
    expect(details.description.length).toBeGreaterThan(0);
    expect(details.textureKey).toBeUndefined();
  });

  test("falls back safely for an unknown item", () => {
    const details = getShopOfferHoverDetails({
      kind: "relic",
      itemId: "missing_relic",
    });

    expect(details.name).toBe("알 수 없는 유물");
    expect(details.textureKey).toBeUndefined();
    expect(details.description).toBe("설명 정보가 없습니다.");
  });
});
