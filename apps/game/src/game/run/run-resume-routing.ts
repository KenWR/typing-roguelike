import {
  generateNodeChoices,
  type GeneratedMapNode,
  type RunState,
} from "@typing-roguelike/shared";
import { initializeCombatEncounter } from "../combat/encounter-initializer";
import { SCENE_KEYS } from "../scenes/scene-contract";
import type { RunResumeCheckpoint } from "./run-resume-checkpoint";

export type RunResumeRoute = Readonly<{
  sceneKey:
    | typeof SCENE_KEYS.map
    | typeof SCENE_KEYS.combat
    | typeof SCENE_KEYS.shop
    | typeof SCENE_KEYS.rest
    | typeof SCENE_KEYS.reward;
  payload: Readonly<Record<string, unknown>>;
  recovered: boolean;
}>;

const findCurrentNode = (
  runState: Readonly<RunState>,
): GeneratedMapNode | undefined => {
  try {
    return generateNodeChoices(
      runState.map.seed,
      runState.map.currentRound,
      runState.map.choicePath,
    ).find((node) => node.key === runState.map.currentNodeId);
  } catch {
    return undefined;
  }
};

const checkpointMatches = (
  runState: Readonly<RunState>,
  node: GeneratedMapNode,
  checkpoint: RunResumeCheckpoint | null,
): checkpoint is RunResumeCheckpoint =>
  checkpoint !== null &&
  checkpoint.node.key === node.key &&
  checkpoint.node.round === node.round &&
  runState.map.nodeStatuses[node.key] === "in_progress";

export const resolveRunResumeRoute = (
  runState: Readonly<RunState>,
  checkpoint: RunResumeCheckpoint | null,
): RunResumeRoute => {
  const node = findCurrentNode(runState);
  if (
    node === undefined ||
    runState.map.nodeStatuses[runState.map.currentNodeId] !== "in_progress"
  ) {
    return {
      sceneKey: SCENE_KEYS.map,
      payload: { runState, recoveryAvailable: true },
      recovered: false,
    };
  }

  const matchingCheckpoint = checkpointMatches(runState, node, checkpoint)
    ? checkpoint
    : null;
  const nextNodeIds = matchingCheckpoint?.nextNodeIds ?? node.nextNodeKeys;
  const commonPayload = {
    runState,
    nodeId: node.key,
    nextNodeIds,
    resumed: true,
  };

  if (node.type === "shop") {
    return {
      sceneKey: SCENE_KEYS.shop,
      payload: {
        ...commonPayload,
        ...(matchingCheckpoint?.shopOffers === undefined
          ? {}
          : { offers: matchingCheckpoint.shopOffers }),
        ...(matchingCheckpoint?.purchasedOfferIds === undefined
          ? {}
          : { purchasedOfferIds: matchingCheckpoint.purchasedOfferIds }),
      },
      recovered: true,
    };
  }

  if (node.type === "rest") {
    return { sceneKey: SCENE_KEYS.rest, payload: commonPayload, recovered: true };
  }

  if (node.type === "reward") {
    return {
      sceneKey: SCENE_KEYS.reward,
      payload: {
        ...commonPayload,
        ...(matchingCheckpoint?.rewardEquipmentIds === undefined
          ? {}
          : { equipmentIds: matchingCheckpoint.rewardEquipmentIds }),
      },
      recovered: true,
    };
  }

  const encounter = initializeCombatEncounter(runState, node);
  if (!encounter.ok) {
    return {
      sceneKey: SCENE_KEYS.map,
      payload: { runState, recoveryAvailable: true },
      recovered: false,
    };
  }

  return {
    sceneKey: SCENE_KEYS.combat,
    payload: {
      ...commonPayload,
      combat: encounter.combat,
      ...(node.type === "boss" ? { bossNode: node } : {}),
    },
    recovered: true,
  };
};
