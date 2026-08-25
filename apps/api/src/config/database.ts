import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";

const databasePath = resolve(process.env.DATABASE_PATH ?? "apps/api/data/game.sqlite");

mkdirSync(dirname(databasePath), { recursive: true });

export const database = new Database(databasePath, { create: true, strict: true });

database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS anonymous_players (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_runs (
    id TEXT PRIMARY KEY,
    anonymous_player_id TEXT NOT NULL REFERENCES anonymous_players(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'dead', 'cleared', 'abandoned')) DEFAULT 'active',
    current_node_id TEXT NOT NULL,
    current_floor INTEGER NOT NULL CHECK (current_floor >= 0),
    state_snapshot TEXT NOT NULL,
    state_version INTEGER NOT NULL CHECK (state_version > 0),
    state_hash TEXT,
    started_at TEXT NOT NULL,
    last_saved_at TEXT NOT NULL,
    ended_at TEXT,
    CHECK ((status = 'active' AND ended_at IS NULL) OR (status <> 'active' AND ended_at IS NOT NULL))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS game_runs_one_active_run_per_player
    ON game_runs (anonymous_player_id) WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS game_runs_player_history_idx
    ON game_runs (anonymous_player_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS run_checkpoints (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    reason TEXT NOT NULL CHECK (reason IN ('run_started', 'node_entered')),
    node_id TEXT NOT NULL,
    floor INTEGER NOT NULL CHECK (floor >= 0),
    state_snapshot TEXT NOT NULL,
    state_hash TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (run_id, sequence_no)
  );
  CREATE INDEX IF NOT EXISTS run_checkpoints_latest_idx
    ON run_checkpoints (run_id, sequence_no DESC);

  CREATE TABLE IF NOT EXISTS run_results (
    run_id TEXT PRIMARY KEY REFERENCES game_runs(id) ON DELETE CASCADE,
    end_reason TEXT NOT NULL CHECK (end_reason IN ('dead', 'cleared', 'abandoned')),
    score INTEGER NOT NULL CHECK (score >= 0),
    cleared_floor INTEGER NOT NULL CHECK (cleared_floor >= 0),
    accuracy REAL CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 100)),
    result_snapshot TEXT NOT NULL DEFAULT '{}',
    finalized_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS run_results_score_ranking_idx
    ON run_results (score DESC, finalized_at ASC);
`);

const resultColumns = database.prepare("PRAGMA table_info(run_results)").all() as Array<{ name: string }>;
for (const column of ["play_time_ms", "max_combo", "defeated_enemy_count", "earned_money"]) {
  if (resultColumns.some((resultColumn) => resultColumn.name === column)) {
    database.exec(`ALTER TABLE run_results DROP COLUMN ${column}`);
  }
}

const gameRunColumns = database.prepare("PRAGMA table_info(game_runs)").all() as Array<{ name: string }>;
if (gameRunColumns.some((column) => column.name === "map_seed")) {
  database.exec("ALTER TABLE game_runs DROP COLUMN map_seed");
}