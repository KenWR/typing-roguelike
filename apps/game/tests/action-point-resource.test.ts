import { describe, expect, test } from "bun:test";
import { ActionPointResource } from "../src/game/combat/action-point-resource";

describe("ActionPointResource", () => {
  test("starts with the default maximum of six AP", () => {
    const resource = new ActionPointResource();
    expect(resource.snapshot).toEqual({ currentAp: 6, maxAp: 6, regenerationPerSecond: 1, paused: false, timedEffects: [] });
  });

  test("spends AP when a skill can start", () => {
    const resource = new ActionPointResource();
    expect(resource.trySpend(2)).toMatchObject({ accepted: true, spentAp: 2, missingAp: 0, snapshot: { currentAp: 4 } });
  });

  test("rejects a skill without consuming AP when the cost is too high", () => {
    const resource = new ActionPointResource({ initialAp: 2 });
    expect(resource.trySpend(3)).toMatchObject({ accepted: false, spentAp: 0, missingAp: 1, snapshot: { currentAp: 2 } });
    expect(resource.snapshot.currentAp).toBe(2);
  });

  test("applies instant AP gains and drains with zero-to-max clamping", () => {
    const resource = new ActionPointResource({ initialAp: 3 });
    expect(resource.adjust(-2).currentAp).toBe(1);
    expect(resource.adjust(-5).currentAp).toBe(0);
    expect(resource.adjust(2).currentAp).toBe(2);
    expect(resource.adjust(20).currentAp).toBe(6);
  });

  test("regenerates continuously at one AP per second without exceeding max", () => {
    const resource = new ActionPointResource({ initialAp: 3 });
    expect(resource.advance(500).currentAp).toBe(3.5);
    expect(resource.advance(1_500).currentAp).toBe(5);
    expect(resource.advance(2_000).currentAp).toBe(6);
  });

  test("applies temporary AP regeneration, exposes its timer, and expires it", () => {
    const resource = new ActionPointResource({ initialAp: 0 });
    resource.addTemporaryRegeneration(0.5, 3_000);
    expect(resource.snapshot.timedEffects).toEqual([
      { id: "temporary-ap-regeneration", amountPerSecond: 0.5, durationMs: 3_000, remainingMs: 3_000 },
    ]);
    expect(resource.advance(2_000)).toMatchObject({
      currentAp: 3,
      regenerationPerSecond: 1.5,
      timedEffects: [{ durationMs: 3_000, remainingMs: 1_000 }],
    });
    expect(resource.advance(1_000).currentAp).toBe(4.5);
    expect(resource.snapshot.regenerationPerSecond).toBe(1);
    expect(resource.snapshot.timedEffects).toEqual([]);
    expect(resource.advance(1_000).currentAp).toBe(5.5);
  });

  test("does not regenerate while paused", () => {
    const resource = new ActionPointResource({ initialAp: 3 });
    resource.pause();
    expect(resource.advance(2_000)).toMatchObject({ currentAp: 3, paused: true });
    resource.resume();
    expect(resource.advance(1_000)).toMatchObject({ currentAp: 4, paused: false });
  });

  test("supports configured max, initial AP, and regeneration rate", () => {
    const resource = new ActionPointResource({ maxAp: 8, initialAp: 5, regenerationPerSecond: 1.2 });
    expect(resource.advance(1_000)).toMatchObject({ currentAp: 6.2, maxAp: 8, regenerationPerSecond: 1.2 });
  });

  test("rejects invalid configuration, costs, deltas, and adjustments", () => {
    expect(() => new ActionPointResource({ maxAp: -1 })).toThrow(RangeError);
    expect(() => new ActionPointResource({ regenerationPerSecond: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    const resource = new ActionPointResource();
    expect(() => resource.trySpend(-1)).toThrow(RangeError);
    expect(() => resource.advance(Number.NaN)).toThrow(RangeError);
    expect(() => resource.adjust(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
