import { describe, expect, test } from "bun:test";
import {
  CORE_SCENE_KEYS,
  SCENE_KEYS,
  isSceneKey,
  isScenePayload,
  resolveSceneTransition,
} from "../src/game/scenes/scene-contract";

describe("scene contract", () => {
  test("registers every core scene key", () => {
    expect(CORE_SCENE_KEYS).toEqual([
      "BootScene",
      "StartScene",
      "SettingsScene",
      "LobbyScene",
      "MapScene",
      "CombatFoundationScene",
      "RewardSelectionScene",
      "EquipmentScene",
      "ShopScene",
      "RestScene",
      "RunResultScene",
    ]);
  });

  test("rejects arbitrary scene names", () => {
    expect(isSceneKey(SCENE_KEYS.map)).toBe(true);
    expect(isSceneKey("AnythingScene")).toBe(false);
  });

  test("validates scene payload shape", () => {
    expect(isScenePayload(SCENE_KEYS.boot, undefined)).toBe(true);
    expect(isScenePayload(SCENE_KEYS.boot, {})).toBe(false);
    expect(isScenePayload(SCENE_KEYS.start, {})).toBe(false);
    expect(isScenePayload(SCENE_KEYS.map, { runState: { hp: 10 } })).toBe(true);
    expect(isScenePayload(SCENE_KEYS.map, "invalid")).toBe(false);
  });

  test("keeps valid transitions and recovers invalid ones to Start", () => {
    const valid = resolveSceneTransition(SCENE_KEYS.map, {
      runState: { hp: 10 },
    });
    expect(valid).toMatchObject({
      key: SCENE_KEYS.map,
      recovered: false,
    });

    const invalidKey = resolveSceneTransition("AnythingScene", {});
    expect(invalidKey).toEqual({
      key: SCENE_KEYS.start,
      payload: {
        recovery: {
          reason: "invalid-scene-transition",
          attemptedScene: "AnythingScene",
        },
      },
      recovered: true,
    });

    const invalidPayload = resolveSceneTransition(SCENE_KEYS.map, "invalid");
    expect(invalidPayload).toEqual({
      key: SCENE_KEYS.start,
      payload: {
        recovery: {
          reason: "invalid-scene-transition",
          attemptedScene: SCENE_KEYS.map,
        },
      },
      recovered: true,
    });
  });
});
