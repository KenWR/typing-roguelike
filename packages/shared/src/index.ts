export type RunStatus = "active" | "dead" | "cleared" | "abandoned";
export type RunEndReason = "dead" | "cleared" | "abandoned";

export interface RunState {
	schemaVersion: number;
	character: Record<string, unknown>;
	inventory: Record<string, unknown>;
	loadout: Record<string, unknown>;
	build: Record<string, unknown>;
	map: {
		mapId: string;
		currentNodeId: string;
		visitedNodeIds: string[];
		nodeStatuses: Record<string, string>;
	};
	runCurrency: number;
}

export interface CreateRunResponse {
	runId: string;
	stateVersion: number;
	checkpoint: RunState;
}

export interface CheckpointRequest {
	nodeId: string;
	floor: number;
	stateVersion: number;
	state: RunState;
}

export interface CompleteRunRequest {
	endReason: RunEndReason;
	score: number;
	clearedFloor: number;
	playTimeMs: number;
	accuracy?: number;
	maxCombo?: number;
	defeatedEnemyCount?: number;
	earnedMoney?: number;
	resultSnapshot?: Record<string, unknown>;
}
