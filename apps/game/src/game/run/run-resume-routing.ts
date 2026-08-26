import type { RunState } from "@typing-roguelike/shared";
import { SCENE_KEYS } from "../scenes/scene-contract";
import type { RunResumeCheckpoint } from "./run-resume-checkpoint";

export type RunResumeRoute = Readonly<{
  sceneKey: typeof SCENE_KEYS.map;
  payload: Readonly<Record<string, unknown>>;
  recovered: boolean;
}>;

export const resolveRunResumeRoute = (
  runState: Readonly<RunState>,
  _checkpoint: RunResumeCheckpoint | null,
): RunResumeRoute => {
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
