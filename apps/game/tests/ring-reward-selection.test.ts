import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS, RING_CONFIGS, applyRingAcquisition, createInitialRunState } from "@typing-roguelike/shared";
import {
  applyEquipmentReward,
  createRunRewardSelectionFlow,
  getRunAvailableSkills,
} from "../src/game/rewards/run-reward-selection";

const requireValue = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error("Expected ring test fixture value.");
  return value;
};

describe("ring combat rewards", () => {
  test("presents an explicit ring override as a ring candidate", () => {
    const ring = requireValue(RING_CONFIGS[0]);
    const flow = createRunRewardSelectionFlow({
      runState: createInitialRunState({ seed: 343 }),
      ringIds: [ring.id],
    });
    const candidate = requireValue(flow.adapter.getViewState().candidates[0]);

    expect(candidate.kind).toBe("ring");
    expect(candidate.name).toBe(ring.name);
    expect(candidate.effect).toContain(ring.commandAffix);
  });

  test("selecting a ring stores and equips it without touching weapon slots", () => {
    const ring = requireValue(RING_CONFIGS[0]);
    const flow = createRunRewardSelectionFlow({
      runState: createInitialRunState({ seed: 344 }),
      ringIds: [ring.id],
    });

    flow.adapter.selectReward(ring.id);
    flow.adapter.continue();
    const updated = flow.adapter.getRunState();

    expect(updated.inventory.itemInstances).toContain(ring.id);
    expect(updated.loadout.ring1Id).toBe(ring.id);
    expect(updated.loadout.weaponId).toBeNull();
    expect(updated.loadout.subweaponId).toBeNull();
  });

  test("offers replacement choices when both ring slots are occupied", () => {
    let runState = createInitialRunState({ seed: 346 });
    runState = applyRingAcquisition(runState, "ring_swift_prefix");
    runState = applyRingAcquisition(runState, "ring_chain_suffix");
    const flow = createRunRewardSelectionFlow({
      runState,
      ringIds: ["ring_fury_prefix"],
    });

    flow.adapter.selectReward("ring_fury_prefix");
    expect(flow.adapter.getRingReplacementOptions().map(({ id }) => id)).toEqual([
      "ring_swift_prefix",
      "ring_chain_suffix",
    ]);
    expect(() => flow.adapter.continue()).toThrow("discard");

    flow.adapter.continue("ring_swift_prefix");
    const updated = flow.adapter.getRunState();
    expect(updated.loadout.ring1Id).toBe("ring_fury_prefix");
    expect(updated.loadout.ring2Id).toBe("ring_chain_suffix");
    expect(updated.inventory.itemInstances).not.toContain("ring_swift_prefix");
  });

  test("generated rewards can contain rings while retaining at least one weapon", () => {
    let sawRing = false;
    for (let seed = 1; seed <= 80; seed += 1) {
      const candidates = createRunRewardSelectionFlow({
        runState: createInitialRunState({ seed }),
        nodeId: "ring-node",
        rewardCount: 4,
      }).adapter.getViewState().candidates;

      expect(candidates).toHaveLength(4);
      expect(candidates.some(({ kind }) => kind === "weapon")).toBe(true);
      expect(candidates.filter(({ kind }) => kind === "relic")).toHaveLength(2);
      if (candidates.some(({ kind }) => kind === "ring")) sawRing = true;
    }
    expect(sawRing).toBe(true);
  });

  test("equipped prefix and suffix rings expand available skills without removing base commands", () => {
    const weapon = requireValue(EQUIPMENT_CONFIGS.find((candidate) => candidate.slot === "weapon"));
    let runState = applyEquipmentReward(createInitialRunState({ seed: 345 }), weapon.id);
    runState = applyRingAcquisition(runState, "ring_swift_prefix");
    runState = applyRingAcquisition(runState, "ring_chain_suffix");

    const skills = getRunAvailableSkills(runState);
    for (const base of weapon.skills) {
      const commands = skills.filter((skill) => skill.id === base.id).map((skill) => skill.command);
      expect(commands).toContain(base.command);
      expect(commands).toContain(`신속한 ${base.command}`);
      expect(commands).toContain(`${base.command} 연속으로`);
      expect(commands).toContain(`신속한 ${base.command} 연속으로`);
    }
  });
});
