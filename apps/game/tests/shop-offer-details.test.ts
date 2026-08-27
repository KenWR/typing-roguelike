/* biome-ignore-all lint/style/noNonNullAssertion: static content fixtures are asserted before access. */
import { describe, expect, test } from "bun:test";
import { getShopOfferHoverDetails } from "../src/game/shop/shop-offer-details";
import { getRingIconTextureKey } from "../src/game/assets/ring-icon-assets";
import { RING_CONFIGS } from "@typing-roguelike/shared";

describe("shop offer hover details", () => {
  test("returns relic image and description", () => {
    const details = getShopOfferHoverDetails({
      kind: "relic",
      itemId: "relic_steel_fragment",
    });

    expect(details.name).toBe("강철 조각");
    expect(details.kindLabel).toBe("유물");
    expect(details.description).toContain("실드량 +8");
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
    expect(details.description).toContain("한손무기");
    expect(details.description).toContain("기본기술");
    expect(details.description).toContain("특수기술");
    expect(details.description).toContain("command:");
    expect(details.description).toContain("cost:");
    expect(details.description).toContain("damage:");
    expect(details.textureKey).toBe("equipment-icon:equipment_rusty_sword");
  });

  test("returns subweapon image and skill description", () => {
    const details = getShopOfferHoverDetails({
      kind: "equipment",
      itemId: "equipment_clear_crystal_orb",
    });

    expect(details.kindLabel).toBe("장비");
    expect(details.description.length).toBeGreaterThan(0);
    expect(details.description).toContain("보조무기");
    expect(details.textureKey).toBe("equipment-icon:equipment_clear_crystal_orb");
  });

  test("returns ring image and effect description", () => {
    const ring = RING_CONFIGS[0]!;
    const details = getShopOfferHoverDetails({ kind: "ring", itemId: ring.id });
    expect(details.textureKey).toBe(getRingIconTextureKey(ring.id));
    expect(details.description).toContain(ring.description);
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
