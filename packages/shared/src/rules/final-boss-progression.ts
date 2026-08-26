import type { RunState, RunMapState } from "../contracts/backend/run-state.ts";
import type { GeneratedMapNode } from "./map-generation.ts";
import { MAP_ROUND_COUNT } from "./map-generation.ts";
import { completeMapNode, getMapNodeStatus } from "./map-node-state.ts";

export type FinalBossProgressionResult<T> = Readonly<{
	applied: boolean;
	state: T;
}>;

const validateFinalBoss = (bossNode: Readonly<GeneratedMapNode>): void => {
	if (bossNode.round !== MAP_ROUND_COUNT || bossNode.type !== "boss") {
		throw new Error("Run completion requires the final-round boss node.");
	}
};

export const unlockFinalBoss = (
	map: Readonly<RunMapState>,
	completedNode: Readonly<GeneratedMapNode>,
	bossNode: Readonly<GeneratedMapNode>,
): FinalBossProgressionResult<RunMapState> => {
	validateFinalBoss(bossNode);
	if (completedNode.round !== MAP_ROUND_COUNT - 1 || completedNode.type !== "rest") {
		throw new Error("The final boss can only be unlocked after the required rest node.");
	}
	if (!completedNode.nextNodeKeys.includes(bossNode.key)) {
		throw new Error("The final boss is not connected to the completed map path.");
	}

	const result = completeMapNode(map, completedNode.key, [bossNode.key]);
	return { applied: result.applied, state: result.map };
};

export const completeFinalBossVictory = (
	runState: Readonly<RunState>,
	bossNode: Readonly<GeneratedMapNode>,
): FinalBossProgressionResult<RunState> => {
	validateFinalBoss(bossNode);
	const bossStatus = getMapNodeStatus(runState.map, bossNode.key);
	if (runState.status === "cleared" && bossStatus === "cleared") {
		return { applied: false, state: runState as RunState };
	}
	if (runState.status !== "active") {
		throw new Error("Only an active run can be cleared by a boss victory.");
	}
	if (runState.map.currentNodeId !== bossNode.key || bossStatus !== "in_progress") {
		throw new Error("The final boss must be the current in-progress map node.");
	}

	return {
		applied: true,
		state: {
			...runState,
			status: "cleared",
			map: {
				...runState.map,
				nodeStatuses: {
					...runState.map.nodeStatuses,
					[bossNode.key]: "cleared",
				},
			},
		},
	};
};
