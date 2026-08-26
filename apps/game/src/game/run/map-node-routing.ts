import {
  beginMapNode,
  generateNodeChoices,
  type GeneratedMapNode,
  type RunState,
} from "@typing-roguelike/shared";
import { enterBossCombat } from "../combat/boss-combat-flow";
import { initializeCombatEncounter } from "../combat/encounter-initializer";
import { createRunRewardSelectionFlow } from "../rewards/run-reward-selection";
import { SCENE_KEYS } from "../scenes/scene-contract";

export type MapNodeRoute = Readonly<{
  applied: boolean;
  runState: RunState;
  sceneKey:
    | typeof SCENE_KEYS.combat
    | typeof SCENE_KEYS.shop
    | typeof SCENE_KEYS.rest
    | typeof SCENE_KEYS.reward
    | typeof SCENE_KEYS.map;
  payload: Readonly<Record<string, unknown>>;
}>;

const findCurrentNode = (
  runState: Readonly<RunState>,
  nodeId: string,
): GeneratedMapNode | undefined =>
  generateNodeChoices(
    runState.map.seed,
    runState.map.currentRound,
    runState.map.choicePath,
  ).find((node) => node.key === nodeId);

export const routeMapNodeSelection = (
  runState: Readonly<RunState>,
  nodeId: string,
): MapNodeRoute => {
  const node = findCurrentNode(runState, nodeId);
  if (node === undefined || runState.map.nodeStatuses[nodeId] !== "available") {
    return { applied: false, runState: runState as RunState, sceneKey: SCENE_KEYS.map, payload: { runState } };
  }

  if (node.type === "boss") {
    const entry = enterBossCombat(runState as RunState, node);
    if (!entry.ok) {
      return { applied: false, runState: runState as RunState, sceneKey: SCENE_KEYS.map, payload: { runState } };
    }
    return {
      applied: true,
      runState: entry.runState,
      sceneKey: entry.sceneKey,
      payload: {
        runState: entry.runState,
        nodeId: node.key,
        nextNodeIds: [],
        bossNode: node,
        combat: entry.combat,
      },
    };
  }

  const selectedRun: RunState = { ...runState, map: beginMapNode(runState.map, node.key) };
  const commonPayload = { runState: selectedRun, nodeId: node.key, nextNodeIds: node.nextNodeKeys };

  if (node.type === "shop") return { applied: true, runState: selectedRun, sceneKey: SCENE_KEYS.shop, payload: commonPayload };
  if (node.type === "rest") return { applied: true, runState: selectedRun, sceneKey: SCENE_KEYS.rest, payload: commonPayload };
  if (node.type === "reward") {
    const rewardFlow = createRunRewardSelectionFlow({
      runState: selectedRun,
      mapCompletion: { nodeId: node.key, nextNodeIds: node.nextNodeKeys },
    });
    return {
      applied: true,
      runState: selectedRun,
      sceneKey: SCENE_KEYS.reward,
      payload: {
        ...commonPayload,
        adapter: rewardFlow.adapter,
        nextSceneKey: rewardFlow.nextSceneKey,
      },
    };
  }

  const encounter = initializeCombatEncounter(selectedRun, node);
  if (!encounter.ok) {
    return { applied: false, runState: runState as RunState, sceneKey: SCENE_KEYS.map, payload: { runState } };
  }

  return {
    applied: true,
    runState: selectedRun,
    sceneKey: SCENE_KEYS.combat,
    payload: { ...commonPayload, combat: encounter.combat },
  };
};
