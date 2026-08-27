import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  RING_CONFIGS,
  createInitialRunState,
} from "@typing-roguelike/shared";
import {
  calculateRunEquipmentExchangeValue,
  getRunEquipmentForExchange,
} from "../src/game/settlement/equipment-exchange";

describe("ring settlement compatibility", () => {
  test("does not treat a known ring as unknown equipment", () => {
    const equipment = EQUIPMENT_CONFIGS[0]!;
    const ring = RING_CONFIGS[0]!;
    const runState = createInitialRunState({ seed: 343 });
    const withItems = {
      ...runState,
      inventory: {
        ...runState.inventory,
        itemInstances: [equipment.id, ring.id],
      },
    };

    expect(getRunEquipmentForExchange(withItems).map((item) => item.id)).toEqual([
      equipment.id,
    ]);
    expect(calculateRunEquipmentExchangeValue(withItems)).toBe(
      equipment.sellValue + ring.sellValue,
    );
  });

  test("still rejects a truly unknown item id", () => {
    const runState = createInitialRunState({ seed: 344 });
    const withUnknown = {
      ...runState,
      inventory: {
        ...runState.inventory,
        itemInstances: ["unknown-run-item"],
      },
    };

    expect(() => calculateRunEquipmentExchangeValue(withUnknown)).toThrow(
      "Unknown equipment in run settlement: unknown-run-item",
    );
  });
});
