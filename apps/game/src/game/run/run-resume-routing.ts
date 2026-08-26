import { generateNodeChoices, type RunState } from "@typing-roguelike/shared";
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
const hasPersistedSelectionPath = (runState: Readonly<RunState>): boolean => {
  const { currentNodeId, currentRound, choicePath, seed } = runState.map;
  if (currentNodeId === "start" || choicePath.length !== currentRound || choicePath.length === 0) {
    return false;
  }

  try {
    const previousPath = choicePath.slice(0, -1);
    const selectedChoice = choicePath[choicePath.length - 1];
    return generateNodeChoices(seed, currentRound, previousPath).some(
      (node) => node.key === currentNodeId && node.choice === selectedChoice,
    );
  } catch {
    return false;
  }
};

const normalizeInterruptedRun = (runState: Readonly<RunState>): RunState => {
  const currentNodeId = runState.map.currentNodeId;
  const currentStatus = runState.map.nodeStatuses[currentNodeId];
  let normalizedMap = runState.map;

  if (currentStatus === "in_progress") {
    normalizedMap = {
      ...normalizedMap,
      nodeStatuses: {
        ...normalizedMap.nodeStatuses,
        [currentNodeId]: "available",
      },
    };
  }

  if (
    (currentStatus === "available" || currentStatus === "in_progress") &&
    hasPersistedSelectionPath(runState)
  ) {
    normalizedMap = {
      ...normalizedMap,
      choicePath: normalizedMap.choicePath.slice(0, -1),
    };
  }

  if (normalizedMap === runState.map) return runState as RunState;

  return {
    ...runState,
    map: normalizedMap,
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
