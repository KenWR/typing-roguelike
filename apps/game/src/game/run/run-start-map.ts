import {
  START_NODE_KEY,
  generateNodeChoices,
  type RunState,
} from "@typing-roguelike/shared";

export const initializeRunMap = (runState: Readonly<RunState>): RunState => {
  const firstRoundNodes = generateNodeChoices(runState.map.seed, 1, []);
  const nodeStatuses = Object.fromEntries(
    firstRoundNodes.map((node) => [node.key, "available"] as const),
  );

  return {
    ...runState,
    map: {
      ...runState.map,
      currentNodeId: START_NODE_KEY,
      currentRound: 1,
      choicePath: [],
      nodeStatuses,
    },
  };
};

export const getAvailableNodeIds = (runState: Readonly<RunState>): string[] =>
  Object.entries(runState.map.nodeStatuses)
    .filter(([, status]) => status === "available")
    .map(([nodeId]) => nodeId);
