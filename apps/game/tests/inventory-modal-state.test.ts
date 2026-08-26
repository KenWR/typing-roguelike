import { describe, expect, test } from "bun:test";
import {
  clampInventoryModalScroll,
  createInventoryModalLayout,
  resolveInventoryModalKey,
} from "../src/game/inventory/inventory-modal-state";

describe("inventory modal state", () => {
  test("resolves the I toggle and Escape close shortcuts", () => {
    expect(resolveInventoryModalKey("i", false)).toBe("toggle");
    expect(resolveInventoryModalKey("I", true)).toBe("toggle");
    expect(resolveInventoryModalKey("Escape", true)).toBe("close");
    expect(resolveInventoryModalKey("Escape", false)).toBe("ignore");
    expect(resolveInventoryModalKey("Enter", true)).toBe("ignore");
  });

  test("clamps modal scroll to the available content range", () => {
    expect(clampInventoryModalScroll(24, 120)).toBe(0);
    expect(clampInventoryModalScroll(-60, 120)).toBe(-60);
    expect(clampInventoryModalScroll(-180, 120)).toBe(-120);
    expect(clampInventoryModalScroll(-60, 0)).toBe(0);
  });

  test("keeps the modal inside the viewport at wide and compact sizes", () => {
    for (const [width, height] of [[1280, 720], [360, 640]] as const) {
      const layout = createInventoryModalLayout(width, height);
      expect(layout.panelX).toBeGreaterThanOrEqual(0);
      expect(layout.panelY).toBeGreaterThanOrEqual(0);
      expect(layout.panelX + layout.panelWidth).toBeLessThanOrEqual(width);
      expect(layout.panelY + layout.panelHeight).toBeLessThanOrEqual(height);
      expect(layout.contentWidth).toBeGreaterThan(0);
      expect(layout.contentHeight).toBeGreaterThan(0);
    }

    expect(createInventoryModalLayout(360, 640).compact).toBe(true);
    expect(createInventoryModalLayout(1280, 720).compact).toBe(false);
  });
});
