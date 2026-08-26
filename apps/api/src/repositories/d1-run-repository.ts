import type { D1Database } from "@cloudflare/workers-types";
import type { RunState, RunStatus } from "@typing-roguelike/shared";
import type {
  ActiveRunRecord,
  CheckpointRecord,
  CheckpointWriteResult,
  CompletionRecord,
  CompletionWriteResult,
  LeaderboardRecord,
  NewRunRecord,
  RunRepository,
  StoredRun,
} from "./run-repository.ts";

interface RunRow {
  runId: string;
  playerId: string;
  status: RunStatus;
  nodeId: string;
  floor: number;
  state: string;
  stateVersion: number;
  stateHash: string | null;
  startedAt: string;
  savedAt: string;
  endedAt: string | null;
}

interface LeaderboardRow {
  score: number;
  clearedFloor: number;
  accuracy: number | null;
  finalizedAt: string;
}

const RUN_COLUMNS = `
  id AS runId,
  anonymous_player_id AS playerId,
  status,
  current_node_id AS nodeId,
  current_floor AS floor,
  state_snapshot AS state,
  state_version AS stateVersion,
  state_hash AS stateHash,
  started_at AS startedAt,
  last_saved_at AS savedAt,
  ended_at AS endedAt
`;

const serializeState = (state: RunState): string => JSON.stringify(state);

const toStoredRun = (row: RunRow): StoredRun => ({
  runId: row.runId,
  playerId: row.playerId,
  status: row.status,
  nodeId: row.nodeId,
  floor: row.floor,
  state: JSON.parse(row.state) as RunState,
  stateVersion: row.stateVersion,
  stateHash: row.stateHash,
  startedAt: row.startedAt,
  savedAt: row.savedAt,
  endedAt: row.endedAt,
});

export class D1RunRepository implements RunRepository {
  public constructor(private readonly database: D1Database) {}

  public async ensureAnonymousPlayer(playerId: string, timestamp: string): Promise<void> {
    await this.database.prepare(`
      INSERT INTO anonymous_players (id, created_at, last_seen_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at
    `).bind(playerId, timestamp, timestamp).run();
  }

  public async createRun(record: NewRunRecord): Promise<"created" | "active_run_exists"> {
    const state = serializeState(record.state);
    const [runInsert, checkpointInsert] = await this.database.batch([
      this.database.prepare(`
        INSERT INTO game_runs (
          id, anonymous_player_id, status, current_node_id, current_floor,
          state_snapshot, state_version, state_hash, started_at, last_saved_at
        )
        SELECT ?, ?, 'active', 'start', 1, ?, 1, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1
          FROM game_runs
          WHERE anonymous_player_id = ? AND status = 'active'
        )
      `).bind(
        record.runId,
        record.playerId,
        state,
        record.stateHash,
        record.timestamp,
        record.timestamp,
        record.playerId,
      ),
      this.database.prepare(`
        INSERT INTO run_checkpoints (
          id, run_id, sequence_no, reason, node_id, floor,
          state_snapshot, state_hash, created_at
        )
        SELECT ?, ?, 1, 'run_started', 'start', 1, ?, ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM game_runs
          WHERE id = ? AND anonymous_player_id = ?
            AND status = 'active' AND state_version = 1
        )
      `).bind(
        record.checkpointId,
        record.runId,
        state,
        record.stateHash,
        record.timestamp,
        record.runId,
        record.playerId,
      ),
    ]);

    if (runInsert.meta.changes !== 1) return "active_run_exists";
    if (checkpointInsert.meta.changes !== 1) {
      throw new Error("RUN_START_CHECKPOINT_WRITE_FAILED");
    }

    return "created";
  }

  public async getActiveRun(playerId: string): Promise<ActiveRunRecord | null> {
    const row = await this.database.prepare(`
      SELECT ${RUN_COLUMNS}
      FROM game_runs
      WHERE anonymous_player_id = ? AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1
    `).bind(playerId).first<RunRow>();

    if (!row) return null;

    const run = toStoredRun(row);
    return {
      runId: run.runId,
      nodeId: run.nodeId,
      floor: run.floor,
      state: run.state,
      stateVersion: run.stateVersion,
      savedAt: run.savedAt,
    };
  }

  public async getOwnedRun(playerId: string, runId: string): Promise<StoredRun | null> {
    const row = await this.database.prepare(`
      SELECT ${RUN_COLUMNS}
      FROM game_runs
      WHERE id = ? AND anonymous_player_id = ?
    `).bind(runId, playerId).first<RunRow>();

    return row ? toStoredRun(row) : null;
  }

  public async saveCheckpoint(record: CheckpointRecord): Promise<CheckpointWriteResult> {
    const state = serializeState(record.state);
    const [runUpdate, checkpointInsert] = await this.database.batch([
      this.database.prepare(`
        UPDATE game_runs
        SET current_node_id = ?, current_floor = ?, state_snapshot = ?,
            state_hash = ?, state_version = state_version + 1, last_saved_at = ?
        WHERE id = ? AND anonymous_player_id = ?
          AND status = 'active' AND state_version = ?
      `).bind(
        record.nodeId,
        record.floor,
        state,
        record.stateHash,
        record.timestamp,
        record.runId,
        record.playerId,
        record.expectedVersion,
      ),
      this.database.prepare(`
        INSERT INTO run_checkpoints (
          id, run_id, sequence_no, reason, node_id, floor,
          state_snapshot, state_hash, created_at
        )
        SELECT ?, ?, ?, 'node_entered', ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM game_runs
          WHERE id = ? AND anonymous_player_id = ?
            AND status = 'active' AND state_version = ?
        )
      `).bind(
        record.checkpointId,
        record.runId,
        record.expectedVersion + 1,
        record.nodeId,
        record.floor,
        state,
        record.stateHash,
        record.timestamp,
        record.runId,
        record.playerId,
        record.expectedVersion + 1,
      ),
    ]);

    if (runUpdate.meta.changes === 1) {
      if (checkpointInsert.meta.changes !== 1) {
        throw new Error("CHECKPOINT_WRITE_FAILED");
      }
      return "saved" as const;
    }

    const currentRun = await this.getOwnedRun(record.playerId, record.runId);
    if (!currentRun) return "run_not_found" as const;
    if (currentRun.status !== "active") return "run_not_active" as const;
    return "stale_state_version" as const;
  }

  public async completeRun(record: CompletionRecord): Promise<CompletionWriteResult> {
    const resultSnapshot = JSON.stringify(record.input.resultSnapshot ?? {});
    const [runUpdate, resultInsert] = await this.database.batch([
      this.database.prepare(`
        UPDATE game_runs
        SET status = ?, ended_at = ?, last_saved_at = ?
        WHERE id = ? AND anonymous_player_id = ? AND status = 'active'
      `).bind(
        record.input.endReason,
        record.timestamp,
        record.timestamp,
        record.runId,
        record.playerId,
      ),
      this.database.prepare(`
        INSERT INTO run_results (
          run_id, end_reason, score, cleared_floor, accuracy,
          result_snapshot, finalized_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM game_runs
          WHERE id = ? AND anonymous_player_id = ?
            AND status = ? AND ended_at = ?
        )
      `).bind(
        record.runId,
        record.input.endReason,
        record.input.score,
        record.input.clearedFloor,
        record.input.accuracy ?? null,
        resultSnapshot,
        record.timestamp,
        record.runId,
        record.playerId,
        record.input.endReason,
        record.timestamp,
      ),
    ]);

    if (runUpdate.meta.changes === 1) {
      if (resultInsert.meta.changes !== 1) {
        throw new Error("RUN_RESULT_WRITE_FAILED");
      }
      return "completed";
    }

    const currentRun = await this.getOwnedRun(record.playerId, record.runId);
    return currentRun ? "run_not_active" : "run_not_found";
  }

  public async getLeaderboard(limit: number): Promise<LeaderboardRecord[]> {
    const result = await this.database.prepare(`
      SELECT
        score,
        cleared_floor AS clearedFloor,
        accuracy,
        finalized_at AS finalizedAt
      FROM run_results
      ORDER BY score DESC, finalized_at ASC
      LIMIT ?
    `).bind(limit).all<LeaderboardRow>();

    return result.results.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
  }
}
