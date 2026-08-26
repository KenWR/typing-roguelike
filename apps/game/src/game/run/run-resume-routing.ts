import { type RunState } from "@typing-roguelike/shared";
import { SCENE_KEYS } from "../scenes/scene-contract";

export type RunResumeRoute = Readonly<{
  sceneKey: typeof SCENE_KEYS.map;
  payload: Readonly<Record<string, unknown>>;
  recovered: boolean;
}>;

/**
 * A node flow is intentionally not resumable. If the browser/process is
 * closed while a node is active, the run returns to map selection and the
 * selected node is made available again.
 */
const normalizeInterruptedRun = (runState: Readonly<RunState>): RunState => {
  const currentNodeId = runState.map.currentNodeId;
  if (runState.map.nodeStatuses[currentNodeId] !== "in_progress") {
    return runState as RunState;
  }

  return {
    ...runState,
    map: {
      ...runState.map,
      nodeStatuses: {
        ...runState.map.nodeStatuses,
        [currentNodeId]: "available",
      },
    },
  };
};

export const resolveRunResumeRoute = (
  runState: Readonly<RunState>,
  _checkpoint: unknown,
): RunResumeRoute => {
  const normalizedRun = normalizeInterruptedRun(runState);
  return {
    sceneKey: SCENE_KEYS.map,
    payload: {
      runState: normalizedRun,
      recoveryAvailable: true,
    },
    recovered: normalizedRun !== runState,
  };
};
