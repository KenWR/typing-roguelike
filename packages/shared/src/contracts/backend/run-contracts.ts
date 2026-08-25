import type { RunState, RunStateStatus } from "./run-state.ts";
import type { GeneratedMapNode } from "../../rules/map-generation.ts";

export type RunStatus = RunStateStatus;
export type RunEndReason = Exclude<RunStatus, "active">;

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
