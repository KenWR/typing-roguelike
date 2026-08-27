import { describe, expect, test } from "bun:test";
import { RING_CONFIGS } from "../src/content/rings.ts";
import { createInitialRunState } from "../src/contracts/backend/run-state.ts";
import { applyRingAcquisition, generateRingRewardCandidates, ownsRing } from "../src/rules/ring-drops.ts";

const requireValue = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error("Expected ring test fixture value.");
  return value;
};

describe("ring drops and acquisition", () => {
  test("generates unique candidates and respects exclusions", () => {
    const excluded = requireValue(RING_CONFIGS[0]).id;
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
    const first = applyRingAcquisition(createInitialRunState({ seed: 343 }), "ring_swift_prefix");
    const second = applyRingAcquisition(first, "ring_chain_suffix");

    expect(second.loadout.ring1Id).toBe("ring_swift_prefix");
    expect(second.loadout.ring2Id).toBe("ring_chain_suffix");
    expect(second.inventory.itemInstances).toEqual(["ring_swift_prefix", "ring_chain_suffix"]);
  });

  test("replaces a selected equipped ring when acquiring a third ring", () => {
    const first = applyRingAcquisition(createInitialRunState({ seed: 343 }), "ring_swift_prefix");
    const second = applyRingAcquisition(first, "ring_chain_suffix");
    const third = applyRingAcquisition(second, "ring_fury_prefix", {
      replaceRingId: "ring_swift_prefix",
    });

    expect(third.loadout.ring1Id).toBe("ring_fury_prefix");
    expect(third.loadout.ring2Id).toBe("ring_chain_suffix");
    expect(third.inventory.itemInstances).not.toContain("ring_swift_prefix");
    expect(third.inventory.itemInstances).toContain("ring_fury_prefix");
  });

  test("can discard a new ring while keeping the existing loadout", () => {
    const first = applyRingAcquisition(createInitialRunState({ seed: 343 }), "ring_swift_prefix");
    const second = applyRingAcquisition(first, "ring_chain_suffix");
    const discarded = applyRingAcquisition(second, "ring_fury_prefix", {
      replaceRingId: null,
    });

    expect(discarded.loadout).toEqual(second.loadout);
    expect(discarded.inventory.itemInstances).toEqual(second.inventory.itemInstances);
  });

  test("requires an explicit choice for a full ring loadout", () => {
    const first = applyRingAcquisition(createInitialRunState({ seed: 343 }), "ring_swift_prefix");
    const second = applyRingAcquisition(first, "ring_chain_suffix");

    expect(() => applyRingAcquisition(second, "ring_fury_prefix")).toThrow("replacement choice");
  });

  test("does not duplicate an already owned ring", () => {
    const first = applyRingAcquisition(createInitialRunState({ seed: 343 }), "ring_swift_prefix");
    const again = applyRingAcquisition(first, "ring_swift_prefix");

    expect(again.inventory.itemInstances.filter((id) => id === "ring_swift_prefix")).toHaveLength(1);
  });
});
