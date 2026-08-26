import { describe, expect, test } from "bun:test";
import {
  createCombatHudState,
  formatCombatHudResourceValue,
  formatCombatHudShieldValue,
  updateCombatHudState,
} from "../src/game/hud/combat-hud";

describe("combat HUD state", () => {
  test("stores current and maximum HP/AP", () => {
    expect(createCombatHudState({ hp: 80, maxHp: 100, ap: 30, maxAp: 50 })).toEqual({
      hp: 80,
      maxHp: 100,
      ap: 30,
      maxAp: 50,
      shield: 0,
    });
  });

  test("updates values immediately and clamps them to their maximum", () => {
    const state = createCombatHudState({ hp: 80, maxHp: 100, ap: 30, maxAp: 50 });

    expect(updateCombatHudState(state, { hp: 45, ap: 65 })).toEqual({
      hp: 45,
      maxHp: 100,
      ap: 50,
      maxAp: 50,
      shield: 0,
    });
  });

  test("tracks the shield granted on command completion alongside HP", () => {
    const state = createCombatHudState({ hp: 80, maxHp: 100, ap: 3, maxAp: 6 });

    expect(updateCombatHudState(state, { shield: 24 }).shield).toBe(24);
    expect(updateCombatHudState(state, { shield: -5 }).shield).toBe(0);
    expect(formatCombatHudShieldValue(24)).toBe(" +24");
    expect(formatCombatHudShieldValue(0)).toBe("");
  });

  test("formats HUD resource values with at most one decimal place", () => {
    expect(formatCombatHudResourceValue(6)).toBe("6");
    expect(formatCombatHudResourceValue(2.5)).toBe("2.5");
    expect(formatCombatHudResourceValue(0.333333)).toBe("0.3");
    expect(formatCombatHudResourceValue(0)).toBe("0");
  });

  test("keeps internal AP precision while clamping minimum and maximum boundaries", () => {
    const preciseAp = 2.2758900000000007;
    const state = createCombatHudState({ hp: 100, maxHp: 100, ap: preciseAp, maxAp: 6 });

    expect(state.ap).toBe(preciseAp);
    expect(formatCombatHudResourceValue(state.ap)).toBe("2.3");
    expect(updateCombatHudState(state, { ap: -1 }).ap).toBe(0);
    expect(updateCombatHudState(state, { ap: 7 }).ap).toBe(6);
  });
});
