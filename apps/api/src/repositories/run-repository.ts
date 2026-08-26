import type {
  CompleteRunRequest,
  RunStatus,
  RunState,
} from "@typing-roguelike/shared";

export interface NewRunRecord {
  runId: string;
  checkpointId: string;
  playerId: string;
  state: RunState;
  stateHash: string;
  timestamp: string;
}

export interface StoredRun {
  runId: string;
  playerId: string;
  status: RunStatus;
  nodeId: string;
  floor: number;
  state: RunState;
  stateVersion: number;
  stateHash: string | null;
  startedAt: string;
  savedAt: string;
  endedAt: string | null;
}

export interface ActiveRunRecord {
  runId: string;
  nodeId: string;
  floor: number;
  state: RunState;
  stateVersion: number;
  savedAt: string;
}

export interface CheckpointRecord {
  checkpointId: string;
  playerId: string;
  runId: string;
  expectedVersion: number;
  nodeId: string;
  floor: number;
  state: RunState;
  stateHash: string;
  timestamp: string;
}

export type CheckpointWriteResult =
  | "saved"
  | "run_not_found"
  | "run_not_active"
  | "stale_state_version";

export interface CompletionRecord {
  playerId: string;
  runId: string;
  input: CompleteRunRequest;
  timestamp: string;
}

export type CompletionWriteResult =
  | "completed"
  | "run_not_found"
  | "run_not_active";

export interface LeaderboardRecord {
  rank: number;
  score: number;
  clearedFloor: number;
  accuracy: number | null;
  finalizedAt: string;
}

export interface RunRepository {
  ensureAnonymousPlayer(playerId: string, timestamp: string): Promise<void>;
  createRun(record: NewRunRecord): Promise<"created" | "active_run_exists">;
  getActiveRun(playerId: string): Promise<ActiveRunRecord | null>;
  getOwnedRun(playerId: string, runId: string): Promise<StoredRun | null>;
  saveCheckpoint(record: CheckpointRecord): Promise<CheckpointWriteResult>;
  completeRun(record: CompletionRecord): Promise<CompletionWriteResult>;
  getLeaderboard(limit: number): Promise<LeaderboardRecord[]>;
}
