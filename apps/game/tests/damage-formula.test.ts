import { describe, expect, test } from "bun:test";
import { calculateDamage } from "../src/game/combat/damage-formula";

describe("calculateDamage", () => {
  test("applies the defense reduction formula", () => {
    expect(
      calculateDamage({
        attackPower: 20,
        damageCoefficient: 1.5,
        defense: 100,
      }),
    ).toBe(15);
  });

  test("deals full base damage against zero defense", () => {
    expect(
      calculateDamage({
        attackPower: 20,
        damageCoefficient: 1.5,
        defense: 0,
      }),
    ).toBe(30);
  });

  test("rounds only the final damage", () => {
    expect(
      calculateDamage({
        attackPower: 10,
        damageCoefficient: 1,
        defense: 50,
      }),
    ).toBe(7);
  });

  test("guarantees at least one damage at the zero boundary", () => {
    expect(
      calculateDamage({
        attackPower: 0,
        damageCoefficient: 0,
        defense: 1_000_000,
      }),
    ).toBe(1);
  });

  test("supports large finite combat stats", () => {
    expect(
      calculateDamage({
        attackPower: 1_000_000_000,
        damageCoefficient: 2,
        defense: 100,
      }),
    ).toBe(1_000_000_000);
  });

  test("rejects negative and non-finite inputs", () => {
    expect(() =>
      calculateDamage({
        attackPower: -1,
        damageCoefficient: 1,
        defense: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateDamage({
        attackPower: 1,
        damageCoefficient: Number.NaN,
        defense: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateDamage({
        attackPower: 1,
        damageCoefficient: 1,
        defense: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(RangeError);
  });
});
