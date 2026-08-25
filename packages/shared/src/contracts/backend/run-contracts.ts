import type { RunState } from "./run-state.ts";
import type { GeneratedMapNode } from "./map-generation.ts";

export type RunStatus = "active" | "dead" | "cleared" | "abandoned";
export type RunEndReason = "dead" | "cleared" | "abandoned";

export interface CreateRunResponse {
	runId: string;
	stateVersion: number;
	checkpoint: RunState;
	nodeChoices: GeneratedMapNode[];
}

export interface CheckpointRequest {
	round: number;
	choice: 1 | 2 | 3;
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