import { describe, expect, test } from "bun:test";
import { HealthState } from "../src/game/combat/health-state";

describe("HealthState", () => {
  test("starts with the default maximum of 100 HP", () => {
    const health = new HealthState();

    expect(health.snapshot).toEqual({
      currentHp: 100,
      maxHp: 100,
      isDead: false,
    });
  });

  test("reduces HP by the applied damage", () => {
    const health = new HealthState();

    expect(health.applyDamage(24)).toEqual({
      appliedDamage: 24,
      deathOccurred: false,
      snapshot: {
        currentHp: 76,
        maxHp: 100,
        isDead: false,
      },
    });
  });

  test("clamps lethal damage at zero and reports the death transition", () => {
    const health = new HealthState({ initialHp: 20 });

    expect(health.applyDamage(25)).toEqual({
      appliedDamage: 20,
      deathOccurred: true,
      snapshot: {
        currentHp: 0,
        maxHp: 100,
        isDead: true,
      },
    });
  });

  test("does not report death more than once", () => {
    const health = new HealthState({ initialHp: 10 });

    expect(health.applyDamage(10).deathOccurred).toBe(true);
    expect(health.applyDamage(10)).toMatchObject({
      appliedDamage: 0,
      deathOccurred: false,
      snapshot: { currentHp: 0, isDead: true },
    });
  });

  test("supports configured maximum and initial HP", () => {
    const health = new HealthState({ maxHp: 150, initialHp: 120 });

    expect(health.snapshot).toEqual({
      currentHp: 120,
      maxHp: 150,
      isDead: false,
    });
  });

  test("clamps initial HP to the configured maximum", () => {
    const health = new HealthState({ maxHp: 80, initialHp: 100 });

    expect(health.snapshot.currentHp).toBe(80);
  });

  test("rejects invalid health values and damage", () => {
    expect(() => new HealthState({ maxHp: 0 })).toThrow(RangeError);
    expect(() => new HealthState({ initialHp: -1 })).toThrow(RangeError);

    const health = new HealthState();
    expect(() => health.applyDamage(-1)).toThrow(RangeError);
    expect(() => health.applyDamage(Number.NaN)).toThrow(RangeError);
  });
});
