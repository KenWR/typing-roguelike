import {
  applyRestRecovery,
  completeMapNode,
  type RunState,
} from "@typing-roguelike/shared";

export type RestNodeFlowState = Readonly<{
  runState: RunState;
  nodeId: string;
  nextNodeIds: readonly string[];
  appliedResultIds: ReadonlySet<string>;
  completed: boolean;
}>;

export const createRestNodeFlow = (
  runState: RunState,
  nodeId: string,
  nextNodeIds: readonly string[],
): RestNodeFlowState => ({
  runState,
  nodeId,
  nextNodeIds: [...nextNodeIds],
  appliedResultIds: new Set<string>(),
  completed: false,
});

export const applyRestNodeRecovery = (
  state: RestNodeFlowState,
  healAmount: number,
): RestNodeFlowState => {
  if (state.completed) throw new Error("Rest node is already complete.");

  const result = applyRestRecovery({
    resultId: `rest:${state.runState.map.mapId}:${state.nodeId}`,
    runState: state.runState,
    config: { healAmount },
    appliedResultIds: state.appliedResultIds,
  });

  return {
    ...state,
    runState: result.runState,
    appliedResultIds: result.appliedResultIds,
  };
};

export const completeRestNode = (state: RestNodeFlowState): RestNodeFlowState => {
  if (state.completed) return state;

  const completedMap = completeMapNode(
    state.runState.map,
    state.nodeId,
    state.nextNodeIds,
  );

  return {
    ...state,
    runState: { ...state.runState, map: completedMap.map },
    completed: true,
  };
};
