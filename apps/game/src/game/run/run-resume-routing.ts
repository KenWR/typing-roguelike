import type { RunState } from "@typing-roguelike/shared";
import { initializeCombatEncounter } from "../combat/encounter-initializer";
import { createRunRewardSelectionFlow } from "../rewards/run-reward-selection";
import { SCENE_KEYS } from "../scenes/scene-contract";
import type { RunResumeCheckpoint } from "./run-resume-checkpoint";

export type RunResumeRoute = Readonly<{
  sceneKey:
    | typeof SCENE_KEYS.map
    | typeof SCENE_KEYS.combat
    | typeof SCENE_KEYS.shop
    | typeof SCENE_KEYS.rest
    | typeof SCENE_KEYS.reward
    | typeof SCENE_KEYS.runResult;
  payload: Readonly<Record<string, unknown>>;
  recovered: boolean;
}>;

const isCheckpointForRun = (
  runState: Readonly<RunState>,
  checkpoint: RunResumeCheckpoint,
): boolean => {
  if (runState.map.currentNodeId !== checkpoint.node.key) return false;
  const status = runState.map.nodeStatuses[checkpoint.node.key];
  if (checkpoint.sceneKey === SCENE_KEYS.reward) {
    return status === "cleared" && runState.map.currentRound > checkpoint.node.round;
  }
  return (
    runState.map.currentRound === checkpoint.node.round &&
    (status === "in_progress" || status === "available")
  );
};

const resumeFromCheckpoint = (
  runState: Readonly<RunState>,
  checkpoint: RunResumeCheckpoint,
): RunResumeRoute | null => {
  if (!isCheckpointForRun(runState, checkpoint)) return null;

  const commonPayload = {
    runState,
    nodeId: checkpoint.node.key,
    node: checkpoint.node,
    nextNodeIds: checkpoint.nextNodeIds,
  };

  if (checkpoint.sceneKey === SCENE_KEYS.combat) {
    const encounter = initializeCombatEncounter(runState, checkpoint.node);
    if (!encounter.ok) return null;
    return {
      sceneKey: SCENE_KEYS.combat,
      payload: {
        ...commonPayload,
        combat: encounter.combat,
        ...(checkpoint.node.type === "boss" ? { bossNode: checkpoint.node } : {}),
      },
      recovered: true,
    };
  }

  if (checkpoint.sceneKey === SCENE_KEYS.shop) {
    return {
      sceneKey: SCENE_KEYS.shop,
      payload: {
        ...commonPayload,
        ...(checkpoint.shopOffers === undefined ? {} : { offers: checkpoint.shopOffers }),
        ...(checkpoint.purchasedOfferIds === undefined
          ? {}
          : { purchasedOfferIds: checkpoint.purchasedOfferIds }),
        rerollCount: checkpoint.shopRerollCount ?? 0,
      },
      recovered: true,
    };
  }

  if (checkpoint.sceneKey === SCENE_KEYS.rest) {
    return {
      sceneKey: SCENE_KEYS.rest,
      payload: commonPayload,
      recovered: true,
    };
  }

  if (checkpoint.sceneKey === SCENE_KEYS.reward) {
    if ((checkpoint.rewardEquipmentIds?.length ?? 0) === 0) return null;
    const rewardFlow = createRunRewardSelectionFlow({
      runState: runState as RunState,
      equipmentIds: checkpoint.rewardEquipmentIds,
    });
    return {
      sceneKey: SCENE_KEYS.reward,
      payload: {
        ...commonPayload,
        adapter: rewardFlow.adapter,
        nextSceneKey: rewardFlow.nextSceneKey,
      },
      recovered: true,
    };
  }

  return null;
};

export const resolveRunResumeRoute = (
  runState: Readonly<RunState>,
  checkpoint: RunResumeCheckpoint | null,
): RunResumeRoute => {
  if (runState.status !== "active") {
    return {
      sceneKey: SCENE_KEYS.runResult,
      payload: {
        runState,
        result: runState.status === "cleared" ? "clear" : "death",
      },
      recovered: true,
    };
  }

  if (checkpoint !== null) {
    const resumed = resumeFromCheckpoint(runState, checkpoint);
    if (resumed !== null) return resumed;
  }

  const nodeStatuses = { ...runState.map.nodeStatuses };
  let changed = false;
  for (const [nodeId, status] of Object.entries(nodeStatuses)) {
    if (status === "in_progress") {
      nodeStatuses[nodeId] = "available";
      changed = true;
    }
  }

  const recoveredRunState: RunState = changed
    ? { ...runState, map: { ...runState.map, nodeStatuses } }
    : runState as RunState;

  return {
    sceneKey: SCENE_KEYS.map,
    payload: { runState: recoveredRunState, recoveryAvailable: changed },
    recovered: changed,
  };
};
