import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MENU_SETTINGS,
  applyMenuSettings,
  cycleVolume,
  loadMenuSettings,
  saveMenuSettings,
  toggleCommandLanguage,
  toggleScreenShake,
  toggleSound,
} from "../src/game/scenes/menu-settings";

describe("menu settings", () => {
  test("toggles supported settings without mutating defaults", () => {
    expect(toggleSound(DEFAULT_MENU_SETTINGS).soundEnabled).toBe(false);
    expect(toggleScreenShake(DEFAULT_MENU_SETTINGS).screenShakeEnabled).toBe(false);
    expect(toggleCommandLanguage(DEFAULT_MENU_SETTINGS).commandLanguage).toBe("en");
    expect(cycleVolume(DEFAULT_MENU_SETTINGS).volume).toBe(0);
    expect(DEFAULT_MENU_SETTINGS).toEqual({
      soundEnabled: true,
      volume: 1,
      screenShakeEnabled: true,
      commandLanguage: "ko",
    });
  });

  test("loads defaults when storage is empty or corrupt", () => {
    expect(loadMenuSettings({ getItem: () => null })).toEqual(DEFAULT_MENU_SETTINGS);
    expect(loadMenuSettings({ getItem: () => "not-json" })).toEqual(DEFAULT_MENU_SETTINGS);
  });

  test("loads legacy settings with new defaults", () => {
    expect(loadMenuSettings({ getItem: () => JSON.stringify({ soundEnabled: false }) })).toEqual({
      soundEnabled: false,
      volume: 1,
      screenShakeEnabled: true,
      commandLanguage: "ko",
    });
  });

  test("saves and restores all supported settings", () => {
    let stored = "";
    const settings = { soundEnabled: false, volume: 0.5, screenShakeEnabled: false, commandLanguage: "en" as const };
    saveMenuSettings(settings, { setItem: (_key, value) => { stored = value; } });
    expect(loadMenuSettings({ getItem: () => stored })).toEqual(settings);
  });

  test("applies audio and runtime settings immediately", () => {
    const registry = new Map<string, unknown>();
    const runtime = {
      sound: { mute: false, volume: 1 },
      registry: { set: (key: string, value: unknown) => registry.set(key, value) },
    };
    applyMenuSettings(runtime, { soundEnabled: false, volume: 0.5, screenShakeEnabled: false, commandLanguage: "en" });
    expect(runtime.sound).toEqual({ mute: true, volume: 0.5 });
    expect(registry.get("settings.screenShakeEnabled")).toBe(false);
    expect(registry.get("settings.commandLanguage")).toBe("en");
  });
});
