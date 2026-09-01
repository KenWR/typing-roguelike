import { describe, expect, test } from "bun:test";
import { resolveSettingsLayout } from "../src/game/scenes/settings-layout";

const buttonBottom = (height: number): number => {
  const layout = resolveSettingsLayout(320, height);
  const settingsBottom = layout.firstSettingTop + 4 * layout.rowHeight + 3 * layout.rowGap;
  return settingsBottom + layout.actionGap + 2 * layout.rowHeight + layout.rowGap;
};

describe("settings layout", () => {
  test.each([521, 520, 480, 400, 320])("keeps all controls inside a %ipx-tall viewport", (height) => {
    const layout = resolveSettingsLayout(320, height);

    expect(layout.panelTop).toBeGreaterThanOrEqual(0);
    expect(layout.panelTop + layout.panelHeight).toBeLessThanOrEqual(height);
    expect(buttonBottom(height)).toBeLessThan(layout.statusY);
    expect(layout.statusY).toBeLessThan(layout.helpY);
    expect(layout.helpY).toBeLessThanOrEqual(layout.panelTop + layout.panelHeight);
  });

  test("retains tight metrics at the former 520px boundary", () => {
    expect(resolveSettingsLayout(1280, 520).rowHeight).toBe(34);
    expect(resolveSettingsLayout(1280, 521).rowHeight).toBe(34);
  });

  test("only expands once the status and help anchors have room", () => {
    const layout = resolveSettingsLayout(1280, 541);

    expect(layout.rowHeight).toBe(44);
    expect(layout.helpY - layout.statusY).toBeGreaterThanOrEqual(20);
  });
});
