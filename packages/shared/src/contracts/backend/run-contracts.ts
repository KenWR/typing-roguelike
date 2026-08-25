import type { RunState } from "./run-state.ts";

export type RunStatus = "active" | "dead" | "cleared" | "abandoned";
export type RunEndReason = "dead" | "cleared" | "abandoned";

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
	accuracy?: number;
	resultSnapshot?: Record<string, unknown>;
}

export interface LeaderboardEntry {
	rank: number;
	score: number;
	clearedFloor: number;
	accuracy: number | null;
	finalizedAt: string;
}

export interface LeaderboardResponse {
	entries: LeaderboardEntry[];
}