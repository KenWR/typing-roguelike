import { describe, expect, test } from "bun:test";
import { RING_CONFIGS } from "../src/content/rings.ts";
import { createInitialRunState } from "../src/contracts/backend/run-state.ts";
import {
  applyRingAcquisition,
  generateRingRewardCandidates,
  ownsRing,
} from "../src/rules/ring-drops.ts";

describe("ring drops and acquisition", () => {
  test("generates unique candidates and respects exclusions", () => {
    const excluded = RING_CONFIGS[0]!.id;
    const rewards = generateRingRewardCandidates({
      count: 3,
      random: () => 0,
      excludedRingIds: [excluded],
    });

    expect(rewards).toHaveLength(3);
    expect(new Set(rewards.map(({ id }) => id)).size).toBe(3);
    expect(rewards.map(({ id }) => id)).not.toContain(excluded);
  });

  test("stores a ring and fills the first empty ring slot", () => {
    const run = createInitialRunState({ seed: 343 });
    const acquired = applyRingAcquisition(run, "ring_swift_prefix");

    expect(ownsRing(acquired, "ring_swift_prefix")).toBe(true);
    expect(acquired.loadout.ring1Id).toBe("ring_swift_prefix");
    expect(acquired.loadout.ring2Id).toBeNull();
    expect(run.inventory.itemInstances).toEqual([]);
    expect(run.loadout.ring1Id).toBeNull();
  });

  test("fills ring2 without replacing ring1", () => {
    const first = applyRingAcquisition(
      createInitialRunState({ seed: 343 }),
      "ring_swift_prefix",
    );
    const second = applyRingAcquisition(first, "ring_chain_suffix");

    expect(second.loadout.ring1Id).toBe("ring_swift_prefix");
    expect(second.loadout.ring2Id).toBe("ring_chain_suffix");
    expect(second.inventory.itemInstances).toEqual([
      "ring_swift_prefix",
      "ring_chain_suffix",
    ]);
  });

  test("keeps both equipped slots when inventory receives a third ring", () => {
    const first = applyRingAcquisition(
      createInitialRunState({ seed: 343 }),
      "ring_swift_prefix",
    );
    const second = applyRingAcquisition(first, "ring_chain_suffix");
    const third = applyRingAcquisition(second, "ring_fury_prefix");

    expect(third.loadout).toEqual(second.loadout);
    expect(third.inventory.itemInstances).toContain("ring_fury_prefix");
  });

  test("does not duplicate an already owned ring", () => {
    const first = applyRingAcquisition(
      createInitialRunState({ seed: 343 }),
      "ring_swift_prefix",
    );
    const again = applyRingAcquisition(first, "ring_swift_prefix");

    expect(again.inventory.itemInstances.filter((id) => id === "ring_swift_prefix")).toHaveLength(1);
  });
});
