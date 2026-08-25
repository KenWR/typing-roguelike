import { createHash, randomUUID } from "node:crypto";
import {
  createInitialRunState,
  generateNodeChoices,
  type CompleteRunRequest,
  type RunState,
} from "@typing-roguelike/shared";
import { database } from "../config/database.ts";

const now = (): string => new Date().toISOString();
const hashState = (state: RunState): string =>
  createHash("sha256").update(JSON.stringify(state)).digest("hex");

const defaultState = (seed: number): RunState =>
  createInitialRunState({ seed });

export const createRun = (playerId: string) => {
  const runId = randomUUID();
  const timestamp = now();
  const mapSeed = Math.floor(Math.random() * 2_147_483_647);
  const state = defaultState(mapSeed);
  const stateJson = JSON.stringify(state);
  const stateHash = hashState(state);

  const transaction = database.transaction(() => {
    const activeRun = database.prepare(
      "SELECT id FROM game_runs WHERE anonymous_player_id = ? AND status = 'active'",
    ).get(playerId) as { id: string } | null;
    if (activeRun) throw new Error("ACTIVE_RUN_EXISTS");

    database.prepare(`
      INSERT INTO game_runs
        (id, anonymous_player_id, current_node_id, current_floor, state_snapshot,
         state_version, state_hash, started_at, last_saved_at)
      VALUES (?, ?, 'start', 1, ?, 1, ?, ?, ?)
    `).run(runId, playerId, stateJson, stateHash, timestamp, timestamp);
    database.prepare(`
      INSERT INTO run_checkpoints
        (id, run_id, sequence_no, reason, node_id, floor, state_snapshot, state_hash, created_at)
      VALUES (?, ?, 1, 'run_started', 'start', 1, ?, ?, ?)
    `).run(randomUUID(), runId, stateJson, stateHash, timestamp);
  });
  transaction();
  return { runId, stateVersion: 1, checkpoint: state, nodeChoices: generateNodeChoices(mapSeed, 1, []) };
};

export const getActiveRun = (playerId: string) => {
  const run = database.prepare(`
  SELECT id AS runId, current_node_id AS nodeId, current_floor AS floor,
         state_snapshot AS state, state_version AS stateVersion, last_saved_at AS savedAt
  FROM game_runs WHERE anonymous_player_id = ? AND status = 'active'
  `).get(playerId) as (Record<string, unknown> & { state: string }) | null;
  if (!run) return null;
  return { ...run, state: JSON.parse(run.state) as RunState };
};

export const saveCheckpoint = (
  playerId: string,
  runId: string,
  round: number,
  choice: 1 | 2 | 3,
  expectedVersion: number,
  state: RunState,
) => {
  const nodeKey = `${round}-${choice}`;
  if (state.map.currentRound !== round || state.map.choicePath.at(-1) !== choice) {
    throw new Error("NODE_STATE_MISMATCH");
  }
  const stateJson = JSON.stringify(state);
  const stateHash = hashState(state);
  const timestamp = now();
  const transaction = database.transaction(() => {
    const result = database.prepare(`
      UPDATE game_runs
      SET current_node_id = ?, current_floor = ?, state_snapshot = ?, state_hash = ?,
          state_version = state_version + 1, last_saved_at = ?
      WHERE id = ? AND anonymous_player_id = ? AND status = 'active' AND state_version = ?
    `).run(nodeKey, round, stateJson, stateHash, timestamp, runId, playerId, expectedVersion);
    if (result.changes === 0) throw new Error("STALE_STATE_VERSION");
    database.prepare(`
      INSERT INTO run_checkpoints
        (id, run_id, sequence_no, reason, node_id, floor, state_snapshot, state_hash, created_at)
      SELECT ?, ?, state_version, 'node_entered', ?, ?, ?, ?, ? FROM game_runs WHERE id = ?
    `).run(randomUUID(), runId, nodeKey, round, stateJson, stateHash, timestamp, runId);
  });
  transaction();
  return {
    stateVersion: expectedVersion + 1,
    savedAt: timestamp,
    nodeChoices: generateNodeChoices(state.map.seed, round + 1, state.map.choicePath),
  };
};

export const completeRun = (playerId: string, runId: string, input: CompleteRunRequest) => {
  const timestamp = now();
  const transaction = database.transaction(() => {
    const result = database.prepare(`
      UPDATE game_runs SET status = ?, ended_at = ?, last_saved_at = ?
      WHERE id = ? AND anonymous_player_id = ? AND status = 'active'
    `).run(input.endReason, timestamp, timestamp, runId, playerId);
    if (result.changes === 0) throw new Error("RUN_NOT_ACTIVE");
    database.prepare(`
      INSERT INTO run_results
        (run_id, end_reason, score, cleared_floor, accuracy, result_snapshot, finalized_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId, input.endReason, input.score, input.clearedFloor, input.accuracy ?? null,
      JSON.stringify(input.resultSnapshot ?? {}), timestamp,
    );
  });
  transaction();
  return { runId, finalizedAt: timestamp };
};

export const getLeaderboard = (limit: number) => database.prepare(`
  SELECT score, cleared_floor AS clearedFloor, accuracy, finalized_at AS finalizedAt
  FROM run_results
  ORDER BY score DESC, finalized_at ASC
  LIMIT ?
`).all(limit).map((entry, index) => ({
  rank: index + 1,
  ...(entry as { score: number; clearedFloor: number; accuracy: number | null; finalizedAt: string }),
}));
