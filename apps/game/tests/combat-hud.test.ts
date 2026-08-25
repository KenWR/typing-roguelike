import { describe, expect, test } from "bun:test";
import { createCombatHudState, updateCombatHudState } from "../src/game/hud/combat-hud";

describe("combat HUD state", () => {
  test("stores current and maximum HP/AP", () => {
    expect(createCombatHudState({ hp: 80, maxHp: 100, ap: 30, maxAp: 50 })).toEqual({
      hp: 80,
      maxHp: 100,
      ap: 30,
      maxAp: 50,
    });
  });

  test("updates values immediately and clamps them to their maximum", () => {
    const state = createCombatHudState({ hp: 80, maxHp: 100, ap: 30, maxAp: 50 });

    expect(updateCombatHudState(state, { hp: 45, ap: 65 })).toEqual({
      hp: 45,
      maxHp: 100,
      ap: 50,
      maxAp: 50,
    });
  });
});
