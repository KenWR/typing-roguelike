import { describe, expect, test } from "bun:test";
import { DefenseWindowTracker } from "../src/game/combat/defense-window";

describe("DefenseWindowTracker", () => {
  test("treats an enemy hit inside the defense interval as defended", () => {
    const tracker = new DefenseWindowTracker();
    tracker.openWindow("guard-1", "player", 1_000, 500);

    expect(tracker.resolveImpact("player", 1_250)).toMatchObject({
      defended: true,
      defenderId: "player",
      impactAtMs: 1_250,
      window: { id: "guard-1" },
    });
  });

  test("includes the exact start and end boundary", () => {
    const tracker = new DefenseWindowTracker();
    tracker.openWindow("guard-1", "player", 1_000, 500);

    expect(tracker.isDefendedAt("player", 1_000)).toBe(true);
    expect(tracker.isDefendedAt("player", 1_500)).toBe(true);
  });

  test("treats hits outside the interval as normal hits", () => {
    const tracker = new DefenseWindowTracker();
    tracker.openWindow("guard-1", "player", 1_000, 500);

    expect(tracker.resolveImpact("player", 999)).toMatchObject({ defended: false, window: null });
    expect(tracker.resolveImpact("player", 1_501)).toMatchObject({ defended: false, window: null });
  });

  test("does not apply another actor's defense window", () => {
    const tracker = new DefenseWindowTracker();
    tracker.openWindow("guard-a", "player-a", 1_000, 500);

    expect(tracker.isDefendedAt("player-b", 1_250)).toBe(false);
  });

  test("supports closing and pruning expired defense windows", () => {
    const tracker = new DefenseWindowTracker();
    tracker.openWindow("old", "player", 100, 100);
    tracker.openWindow("current", "player", 400, 200);

    tracker.pruneExpired(350);
    expect(tracker.isDefendedAt("player", 150)).toBe(false);
    expect(tracker.isDefendedAt("player", 500)).toBe(true);

    expect(tracker.closeWindow("current")).toBe(true);
    expect(tracker.isDefendedAt("player", 500)).toBe(false);
  });

  test("rejects duplicate ids and invalid timing values", () => {
    const tracker = new DefenseWindowTracker();
    tracker.openWindow("guard-1", "player", 0, 100);

    expect(() => tracker.openWindow("guard-1", "player", 200, 100)).toThrow();
    expect(() => tracker.openWindow("guard-2", "player", -1, 100)).toThrow(RangeError);
    expect(() => tracker.openWindow("guard-3", "player", 0, Number.NaN)).toThrow(RangeError);
    expect(() => tracker.resolveImpact("", 50)).toThrow(RangeError);
  });
});
