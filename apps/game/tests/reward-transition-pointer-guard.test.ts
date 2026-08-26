import { describe, expect, test } from "bun:test";
import { createRewardTransitionPointerGuard } from "../src/game/rewards/reward-transition-pointer-guard";

describe("reward transition pointer guard", () => {
  test("blocks the pointerdown that entered the reward scene until release", () => {
    const guard = createRewardTransitionPointerGuard(true);

    expect(guard.acceptsPointerDown()).toBe(false);
    expect(guard.acceptsPointerDown()).toBe(false);

    guard.release();

    expect(guard.acceptsPointerDown()).toBe(true);
  });

  test("accepts a fresh pointerdown when no transition pointer is being carried", () => {
    const guard = createRewardTransitionPointerGuard();

    expect(guard.acceptsPointerDown()).toBe(true);
  });
});
