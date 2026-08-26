import { describe, expect, test } from "bun:test";
import {
  PLAYER_WEAPON_IMAGE_ASSETS,
  resolvePlayerTextureKey,
} from "../src/game/assets/player-visual-assets";

describe("player visual assets", () => {
  test("preloads one player image for every main weapon kind", () => {
    expect(PLAYER_WEAPON_IMAGE_ASSETS).toHaveLength(8);
    expect(PLAYER_WEAPON_IMAGE_ASSETS).toContainEqual({
      key: "player:greatsword",
      path: "/assets/weapons/player-greatsword.png",
    });
  });

  test("selects the player image from the equipped primary weapon", () => {
    expect(resolvePlayerTextureKey("equipment_rusty_sword")).toBe("player:sword");
    expect(resolvePlayerTextureKey("equipment_military_greatsword")).toBe(
      "player:greatsword",
    );
    expect(resolvePlayerTextureKey("equipment_gear_crossbow")).toBe(
      "player:crossbow",
    );
  });

  test("does not treat subweapons or unknown equipment as a primary weapon", () => {
    expect(resolvePlayerTextureKey("equipment_guard_round_shield")).toBeUndefined();
    expect(resolvePlayerTextureKey("unknown")).toBeUndefined();
    expect(resolvePlayerTextureKey(undefined)).toBeUndefined();
  });
});