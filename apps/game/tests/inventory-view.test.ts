import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  RELIC_CONFIGS,
  RING_CONFIGS,
  createInitialRunState,
} from "@typing-roguelike/shared";
import { createInventoryView } from "../src/game/inventory/inventory-view";

describe("inventory view", () => {
  test("maps every owned equipment and marks loadout equipment", () => {
    const equipment = EQUIPMENT_CONFIGS[0]!;
    const relic = RELIC_CONFIGS[0]!;
    const runState = createInitialRunState({ seed: 1 });
    const view = createInventoryView({
      ...runState,
      inventory: {
        itemInstances: [equipment.id, "equipment_unknown"],
        relicInstances: [relic.id],
      },
      loadout: { ...runState.loadout, weaponId: equipment.id },
      build: { equippedRelicIds: [relic.id] },
    });

    expect(view.equipment.map((item) => item.id)).toEqual([
      equipment.id,
      "equipment_unknown",
    ]);
    expect(view.equipment[0]).toMatchObject({
      name: equipment.name,
      rarity: equipment.rarity,
      slot: equipment.slot,
      isEquipped: true,
    });
    expect(view.equipment[0]!.skills[0]).toMatchObject({
      id: equipment.skills[0]!.id,
      name: equipment.skills[0]!.name,
      command: equipment.skills[0]!.command,
      effect: equipment.skills[0]!.effect ?? equipment.skills[0]!.description,
    });
    expect(view.equipment[1]).toMatchObject({
      name: "equipment_unknown",
      slot: "unknown",
      isEquipped: false,
    });
    expect(view.equipment[1]!.skills[0]!.effect).toBe(
      "등록되지 않은 장비입니다.",
    );
    expect(view.relics).toEqual([
      {
        id: relic.id,
        name: relic.name,
        rarity: relic.rarity,
        description: relic.description,
        isActive: true,
      },
    ]);
  });

  test("renders an owned ring with its real name, affix, effect, and equipped state", () => {
    const ring = RING_CONFIGS[0]!;
    const runState = createInitialRunState({ seed: 343 });
    const view = createInventoryView({
      ...runState,
      inventory: {
        ...runState.inventory,
        itemInstances: [ring.id],
      },
      loadout: {
        ...runState.loadout,
        ring1Id: ring.id,
      },
    });

    expect(view.equipment).toHaveLength(1);
    expect(view.equipment[0]).toMatchObject({
      id: ring.id,
      name: ring.name,
      rarity: ring.rarity,
      isEquipped: true,
    });
    expect(view.equipment[0]!.skills[0]).toMatchObject({
      name: ring.position === "prefix" ? "반지 · 접두사" : "반지 · 접미사",
      effect: ring.description,
    });
    expect(view.equipment[0]!.skills[0]!.command).toContain(ring.commandAffix);
    expect(view.equipment[0]!.skills[0]!.effect).not.toBe("등록되지 않은 장비입니다.");
  });

  test("keeps unknown relics and empty inventory safe", () => {
    const runState = createInitialRunState({ seed: 2 });

    expect(createInventoryView(runState)).toEqual({
      equipment: [],
      relics: [],
    });

    const view = createInventoryView({
      ...runState,
      inventory: {
        itemInstances: [],
        relicInstances: ["relic_unknown"],
      },
    });

    expect(view.relics).toEqual([
      {
        id: "relic_unknown",
        name: "relic_unknown",
        rarity: "common",
        description: "등록되지 않은 유물입니다.",
        isActive: false,
      },
    ]);
  });
});
