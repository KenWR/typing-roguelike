import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MENU_SETTINGS,
  loadMenuSettings,
  saveMenuSettings,
  toggleSound,
} from "../src/game/scenes/menu-settings";

describe("menu settings", () => {
  test("toggles sound without mutating the input", () => {
    const next = toggleSound(DEFAULT_MENU_SETTINGS);
    expect(next.soundEnabled).toBe(false);
    expect(DEFAULT_MENU_SETTINGS.soundEnabled).toBe(true);
  });

  test("loads defaults when storage is empty or corrupt", () => {
    expect(loadMenuSettings({ getItem: () => null })).toEqual(DEFAULT_MENU_SETTINGS);
    expect(loadMenuSettings({ getItem: () => "not-json" })).toEqual(DEFAULT_MENU_SETTINGS);
  });

  test("loads and saves a valid sound setting", () => {
    let stored = "";
    saveMenuSettings(
      { soundEnabled: false },
      { setItem: (_key, value) => { stored = value; } },
    );

    expect(loadMenuSettings({ getItem: () => stored })).toEqual({ soundEnabled: false });
  });
});
