import { describe, expect, test } from "bun:test";
import {
  createEquipmentAdapter,
  EQUIPMENT_SLOTS,
} from "../src/game/equipment/equipment-adapter";
import {
  createEquipmentViewState,
  equipSelectedEquipment,
  getSkillComparison,
  selectEquipment,
  selectSlot,
} from "../src/game/equipment/equipment-view-state";

describe("equipment view state", () => {
  test("exposes weapon, offhand, and two ring slots", () => {
    const adapter = createEquipmentAdapter();
    const state = createEquipmentViewState(adapter.getSnapshot());

    expect(EQUIPMENT_SLOTS).toEqual([
      "weapon",
      "offhand",
      "ring-1",
      "ring-2",
    ]);
    expect(Object.keys(state.snapshot.equippedBySlot)).toEqual(
      expect.arrayContaining(EQUIPMENT_SLOTS),
    );
  });

  test("previews the skill changes for a selected owned item", () => {
    const adapter = createEquipmentAdapter();
    let state = createEquipmentViewState(adapter.getSnapshot());

    state = selectSlot(state, "weapon");
    state = selectEquipment(state, "weapon-voidfang");

    const comparison = getSkillComparison(state);

    expect(state.selectedEquipmentId).toBe("weapon-voidfang");
    expect(comparison.before.name).toBe("Emberline Saber");
    expect(comparison.after.name).toBe("Voidfang Greatsword");
    expect(comparison.added.length).toBeGreaterThan(0);
    expect(comparison.removed.length).toBeGreaterThan(0);
  });

  test("commits the selected item through the adapter", () => {
    const adapter = createEquipmentAdapter();
    let state = createEquipmentViewState(adapter.getSnapshot());

    state = selectEquipment(state, "weapon-voidfang");
    state = equipSelectedEquipment(state, adapter);

    expect(state.snapshot.equippedBySlot.weapon).toBe("weapon-voidfang");
    expect(state.selectedEquipmentId).toBe("weapon-voidfang");
    expect(getSkillComparison(state).added).toEqual([]);
    expect(getSkillComparison(state).removed).toEqual([]);
  });

  test("keeps snapshots isolated from later adapter changes", () => {
    const adapter = createEquipmentAdapter();
    const before = adapter.getSnapshot();

    adapter.equip("weapon", "weapon-voidfang");
    const after = adapter.getSnapshot();

    expect(before.equippedBySlot.weapon).toBe("weapon-emberline");
    expect(after.equippedBySlot.weapon).toBe("weapon-voidfang");
    expect(before).not.toBe(after);
    expect(before.ownedEquipment).not.toBe(after.ownedEquipment);
    expect(before.ownedEquipment[0].skills).not.toBe(
      after.ownedEquipment[0].skills,
    );
  });

  test("rejects an unknown or incompatible equipment selection", () => {
    const adapter = createEquipmentAdapter();

    expect(() => adapter.equip("weapon", "missing-equipment")).toThrow(
      "Unknown equipment: missing-equipment",
    );
    expect(() => adapter.equip("weapon", "ring-orbit")).toThrow(
      "Equipment ring-orbit cannot be equipped in weapon.",
    );
  });

  test("does not select an item belonging to another slot", () => {
    const adapter = createEquipmentAdapter();
    const state = createEquipmentViewState(adapter.getSnapshot());

    expect(selectEquipment(state, "ring-echoes")).toEqual(state);
  });
});
