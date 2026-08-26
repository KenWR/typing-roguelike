import { describe, expect, test } from "bun:test";
import {
  LOADOUT_SLOTS,
  canEquipLoadoutItem,
  equipLoadoutItem,
  getLoadoutSlotItemType,
  unequipLoadoutSlot,
} from "../src/rules/loadout-slots.ts";
import type { RunLoadoutState } from "../src/contracts/backend/run-state.ts";

const emptyLoadout = (): RunLoadoutState => ({
  weaponId: null,
  subweaponId: null,
  ring1Id: null,
  ring2Id: null,
});

describe("four-slot loadout rules", () => {
  test("distinguishes weapon, subweapon, and two ring slots", () => {
    expect(LOADOUT_SLOTS).toEqual(["weaponId", "subweaponId", "ring1Id", "ring2Id"]);
    expect(getLoadoutSlotItemType("weaponId")).toBe("weapon");
    expect(getLoadoutSlotItemType("subweaponId")).toBe("subweapon");
    expect(getLoadoutSlotItemType("ring1Id")).toBe("ring");
    expect(getLoadoutSlotItemType("ring2Id")).toBe("ring");
  });

  test("rejects items equipped into incompatible slots", () => {
    expect(canEquipLoadoutItem("weapon", "weaponId")).toBe(true);
    expect(canEquipLoadoutItem("weapon", "subweaponId")).toBe(false);
    expect(canEquipLoadoutItem("ring", "ring1Id")).toBe(true);
    expect(canEquipLoadoutItem("ring", "ring2Id")).toBe(true);

    expect(() => equipLoadoutItem({
      loadout: emptyLoadout(),
      itemId: "weapon-test",
      itemType: "weapon",
      targetSlot: "ring1Id",
    })).toThrow(RangeError);
  });

  test("equips and replaces an item in the same slot", () => {
    const first = equipLoadoutItem({
      loadout: emptyLoadout(),
      itemId: "weapon-a",
      itemType: "weapon",
      targetSlot: "weaponId",
    });
    const second = equipLoadoutItem({
      loadout: first.loadout,
      itemId: "weapon-b",
      itemType: "weapon",
      targetSlot: "weaponId",
    });

    expect(first.replacedItemId).toBeNull();
    expect(first.loadout.weaponId).toBe("weapon-a");
    expect(second.replacedItemId).toBe("weapon-a");
    expect(second.loadout.weaponId).toBe("weapon-b");
  });

  test("manages two ring slots independently", () => {
    const ring1 = equipLoadoutItem({
      loadout: emptyLoadout(),
      itemId: "ring-a",
      itemType: "ring",
      targetSlot: "ring1Id",
    });
    const ring2 = equipLoadoutItem({
      loadout: ring1.loadout,
      itemId: "ring-b",
      itemType: "ring",
      targetSlot: "ring2Id",
    });

    expect(ring2.loadout.ring1Id).toBe("ring-a");
    expect(ring2.loadout.ring2Id).toBe("ring-b");
    expect(unequipLoadoutSlot(ring2.loadout, "ring1Id")).toEqual({
      ...ring2.loadout,
      ring1Id: null,
    });
  });

  test("rejects blank item ids without mutating the loadout", () => {
    const loadout = emptyLoadout();
    expect(() => equipLoadoutItem({
      loadout,
      itemId: "   ",
      itemType: "subweapon",
      targetSlot: "subweaponId",
    })).toThrow(RangeError);
    expect(loadout).toEqual(emptyLoadout());
  });
});
