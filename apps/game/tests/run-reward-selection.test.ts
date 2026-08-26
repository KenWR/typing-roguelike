import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  RELIC_CONFIGS,
  createInitialRunState,
} from "@typing-roguelike/shared";
import { resolveEquipmentIconTextureKey } from "../src/game/assets/equipment-icon-assets";
import {
  applyEquipmentReward,
  createRunRewardSelectionFlow,
  getRunAvailableSkills,
} from "../src/game/rewards/run-reward-selection";

describe("run reward equipment presentation", () => {
  test("gives weapon candidates the matching equipment icon", () => {
    const weapon = EQUIPMENT_CONFIGS.find((equipment) => equipment.slot === "weapon");
    expect(weapon).toBeDefined();

    const flow = createRunRewardSelectionFlow({
      runState: createInitialRunState({ seed: 30 }),
      equipmentIds: [weapon!.id],
    });
    const candidate = flow.adapter.getViewState().candidates[0];

    expect(candidate?.imageKey).toBe(`equipment-icon:${weapon!.id}`);
    expect(candidate?.imageKey).toBe(resolveEquipmentIconTextureKey(weapon!.id));
  });

  test("gives subweapon candidates the matching uploaded image", () => {
    const subweapon = EQUIPMENT_CONFIGS.find(
      (equipment) => equipment.slot === "subweapon",
    );
    expect(subweapon).toBeDefined();

    const flow = createRunRewardSelectionFlow({
      runState: createInitialRunState({ seed: 31 }),
      equipmentIds: [subweapon!.id],
    });
    const candidate = flow.adapter.getViewState().candidates[0];

    expect(candidate?.imageKey).toBe(`equipment-icon:${subweapon!.id}`);
    expect(candidate?.imageKey).toBe(resolveEquipmentIconTextureKey(subweapon!.id));
    expect(candidate?.icon).toBe("◇");
  });
});

describe("run reward equipment flow", () => {
  test("adds and equips a selected weapon and refreshes available skills", () => {
    const weapon = EQUIPMENT_CONFIGS.find((equipment) => equipment.slot === "weapon");
    expect(weapon).toBeDefined();
    const initial = createInitialRunState({ seed: 10 });

    const flow = createRunRewardSelectionFlow({
      runState: initial,
      equipmentIds: [weapon!.id],
    });
    flow.adapter.selectReward(weapon!.id);
    flow.adapter.continue();

    const updated = flow.adapter.getRunState();
    expect(updated.inventory.itemInstances).toContain(weapon!.id);
    expect(updated.loadout.weaponId).toBe(weapon!.id);
    expect(flow.getAvailableSkills().map((skill) => skill.id)).toEqual(
      weapon!.skills.map((skill) => skill.id),
    );
    expect(flow.nextSceneKey).toBe("MapScene");
  });

  test("fills or replaces the subweapon slot", () => {
    const subweapons = EQUIPMENT_CONFIGS.filter((equipment) => equipment.slot === "subweapon");
    expect(subweapons.length).toBeGreaterThan(0);
    const first = subweapons[0]!;
    const second = subweapons[1] ?? first;
    let runState = createInitialRunState({ seed: 20 });

    runState = applyEquipmentReward(runState, first.id);
    expect(runState.loadout.subweaponId).toBe(first.id);

    runState = applyEquipmentReward(runState, second.id);
    expect(runState.loadout.subweaponId).toBe(second.id);
    expect(runState.inventory.itemInstances).toContain(first.id);
    expect(runState.inventory.itemInstances).toContain(second.id);
  });

  test("confirmation applies only once", () => {
    const equipment = EQUIPMENT_CONFIGS.find((candidate) => candidate.rarity !== "hidden")!;
    const flow = createRunRewardSelectionFlow({
      runState: createInitialRunState({ seed: 30 }),
      equipmentIds: [equipment.id],
    });

    flow.adapter.selectReward(equipment.id);
    flow.adapter.continue();
    const afterFirst = flow.adapter.getRunState();

    expect(() => flow.adapter.continue()).toThrow("already complete");
    expect(flow.adapter.getRunState()).toEqual(afterFirst);
  });

  test("available skills are derived from both equipped weapon slots", () => {
    const weapon = EQUIPMENT_CONFIGS.find((equipment) => equipment.slot === "weapon")!;
    const subweapon = EQUIPMENT_CONFIGS.find((equipment) => equipment.slot === "subweapon")!;
    let runState = createInitialRunState({ seed: 40 });
    runState = applyEquipmentReward(runState, weapon.id);
    runState = applyEquipmentReward(runState, subweapon.id);

    expect(getRunAvailableSkills(runState).map((skill) => skill.id)).toEqual([
      ...weapon.skills.map((skill) => skill.id),
      ...subweapon.skills.map((skill) => skill.id),
    ]);
  });
});

describe("run reward relic candidates", () => {
  test("mixes relics into the generated candidates while keeping a weapon", () => {
    // seed 를 바꿔가며 유물이 실제로 섞여 나오는지 확인한다.
    let sawRelic = false;

    for (let seed = 1; seed <= 40; seed += 1) {
      const flow = createRunRewardSelectionFlow({
        runState: createInitialRunState({ seed }),
        nodeId: "node-1",
      });
      const candidates = flow.adapter.getViewState().candidates;

      expect(candidates).toHaveLength(3);
      expect(candidates.some((candidate) => candidate.kind === "weapon")).toBe(true);
      if (candidates.some((candidate) => candidate.kind === "relic")) sawRelic = true;
    }

    expect(sawRelic).toBe(true);
  });

  test("is deterministic for the same seed and node", () => {
    const build = () =>
      createRunRewardSelectionFlow({
        runState: createInitialRunState({ seed: 77 }),
        nodeId: "node-a",
      }).adapter.getViewState().candidates.map((candidate) => `${candidate.kind}:${candidate.id}`);

    expect(build()).toEqual(build());
  });

  test("gives relic candidates their icon and description", () => {
    const relic = RELIC_CONFIGS[0]!;
    const flow = createRunRewardSelectionFlow({
      runState: createInitialRunState({ seed: 51 }),
      relicIds: [relic.id],
    });
    const candidate = flow.adapter.getViewState().candidates[0]!;

    expect(candidate.kind).toBe("relic");
    expect(candidate.name).toBe(relic.name);
    expect(candidate.description).toBe(relic.description);
    expect(candidate.imageKey).toBe(`relic-icon:${relic.id}`);
  });

  test("selecting a relic stores and equips it", () => {
    const relic = RELIC_CONFIGS[0]!;
    const flow = createRunRewardSelectionFlow({
      runState: createInitialRunState({ seed: 52 }),
      relicIds: [relic.id],
    });

    flow.adapter.selectReward(relic.id);
    flow.adapter.continue();

    const updated = flow.adapter.getRunState();
    expect(updated.inventory.relicInstances).toEqual([relic.id]);
    expect(updated.build.equippedRelicIds).toEqual([relic.id]);
    // 유물은 장비 슬롯을 건드리지 않는다.
    expect(updated.loadout.weaponId).toBeNull();
    expect(updated.inventory.itemInstances).toEqual([]);
  });

  test("never offers a relic the run already owns", () => {
    const owned = RELIC_CONFIGS.slice(0, 50).map((relic) => relic.id);

    for (let seed = 1; seed <= 20; seed += 1) {
      const runState = {
        ...createInitialRunState({ seed }),
        inventory: { itemInstances: [], relicInstances: [...owned] },
      };
      const candidates = createRunRewardSelectionFlow({ runState, nodeId: "node-x" })
        .adapter.getViewState().candidates;

      for (const candidate of candidates) {
        if (candidate.kind === "relic") expect(owned).not.toContain(candidate.id);
      }
    }
  });
});
