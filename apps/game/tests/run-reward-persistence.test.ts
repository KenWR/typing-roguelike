import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
  type GeneratedMapNode,
} from "@typing-roguelike/shared";
import { persistCompletedRunReward } from "../src/game/rewards/run-reward-persistence";
import type { RunStorage } from "../src/game/run/run-persistence";
import { RUN_RESUME_CHECKPOINT_VERSION } from "../src/game/run/run-resume-checkpoint";
import { RunSession } from "../src/game/run/run-session";
import { SCENE_KEYS } from "../src/game/scenes/scene-contract";

const createMemoryStorage = (): RunStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

const rewardNode: GeneratedMapNode = {
  key: "1-1",
  parentKey: "start",
  round: 1,
  choice: 1,
  type: "combat",
  icon: "combat",
  iconType: "combat",
  nextNodeKeys: ["2-1"],
};

describe("completed run reward persistence", () => {
  test("stores the selected reward and clears its resume checkpoint together", () => {
    const storage = createMemoryStorage();
    const session = new RunSession(storage);
    const initial = session.create({ seed: 501 });
    const rewardId = EQUIPMENT_CONFIGS[0]!.id;
    session.setCheckpoint({
      version: RUN_RESUME_CHECKPOINT_VERSION,
      sceneKey: SCENE_KEYS.reward,
      node: rewardNode,
      nextNodeIds: rewardNode.nextNodeKeys,
      rewardEquipmentIds: [rewardId],
    });
    const completedRun = {
      ...initial,
      inventory: {
        ...initial.inventory,
        itemInstances: [...initial.inventory.itemInstances, rewardId],
      },
    };

    expect(persistCompletedRunReward(completedRun, session)).toBe(true);
    expect(session.require().inventory.itemInstances).toContain(rewardId);
    expect(session.getCheckpoint()).toBeNull();

    const afterReload = new RunSession(storage);
    expect(afterReload.restore()?.inventory.itemInstances).toContain(rewardId);
    expect(afterReload.getCheckpoint()).toBeNull();
  });

  test("does not discard a checkpoint when no active run can be updated", () => {
    const session = new RunSession(undefined);
    const completedRun = createInitialRunState({ seed: 502 });
    session.setCheckpoint({
      version: RUN_RESUME_CHECKPOINT_VERSION,
      sceneKey: SCENE_KEYS.reward,
      node: rewardNode,
      nextNodeIds: rewardNode.nextNodeKeys,
      rewardEquipmentIds: [EQUIPMENT_CONFIGS[0]!.id],
    });

    expect(persistCompletedRunReward(completedRun, session)).toBe(false);
    expect(session.getCheckpoint()).not.toBeNull();
  });
});
