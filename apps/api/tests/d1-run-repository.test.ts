import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, test } from "bun:test";
import { createApp } from "../src/app.ts";
import { D1RunRepository } from "../src/repositories/d1-run-repository.ts";
import { createRunService } from "../src/services/run-service.ts";
import { createInitialRunState } from "@typing-roguelike/shared";
import { asD1Database, MemoryD1Database } from "./support/memory-d1.ts";

const schema = readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8");
const createRepository = () => new D1RunRepository(asD1Database(new MemoryD1Database(schema)));

const playerId = "00000000-0000-4000-8000-000000000001";
const otherPlayerId = "00000000-0000-4000-8000-000000000002";

const createRecord = (runId: string, checkpointId: string) => {
  const state = createInitialRunState({ seed: 42 });
  return {
    runId,
    checkpointId,
    playerId,
    state,
    stateHash: "state-hash",
    timestamp: "2026-08-26T00:00:00.000Z",
  };
};

const listen = async (repository: D1RunRepository) => {
  const server = createApp({ repository }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const close = async (server: ReturnType<ReturnType<typeof createApp>["listen"]>) => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

let activeServer: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;

afterEach(async () => {
  if (activeServer) {
    await close(activeServer);
    activeServer = undefined;
  }
});

describe("D1 run repository", () => {
  test("creates the required tables and indexes from the initial migration", () => {
    const database = new MemoryD1Database(schema);
    const tables = database.query<{ name: string }>(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN (
        'anonymous_players', 'game_runs', 'run_checkpoints', 'run_results'
      )
      ORDER BY name
    `).map(({ name }) => name);
    const indexes = database.query<{ name: string }>(`
      SELECT name FROM sqlite_master
      WHERE type = 'index' AND name IN (
        'game_runs_one_active_run_per_player',
        'game_runs_player_history_idx',
        'run_checkpoints_latest_idx',
        'run_results_score_ranking_idx'
      )
      ORDER BY name
    `).map(({ name }) => name);

    expect(tables).toEqual([
      "anonymous_players",
      "game_runs",
      "run_checkpoints",
      "run_results",
    ]);
    expect(indexes).toEqual([
      "game_runs_one_active_run_per_player",
      "game_runs_player_history_idx",
      "run_checkpoints_latest_idx",
      "run_results_score_ranking_idx",
    ]);
  });

  test("atomically creates a run and its initial checkpoint, with one active run per player", async () => {
    const repository = createRepository();
    await repository.ensureAnonymousPlayer(playerId, "2026-08-26T00:00:00.000Z");

    const first = createRecord(
      "00000000-0000-4000-8000-000000000101",
      "00000000-0000-4000-8000-000000000201",
    );
    expect(await repository.createRun(first)).toBe("created");
    expect(await repository.createRun({
      ...first,
      runId: "00000000-0000-4000-8000-000000000102",
      checkpointId: "00000000-0000-4000-8000-000000000202",
    })).toBe("active_run_exists");

    const active = await repository.getActiveRun(playerId);
    expect(active).toMatchObject({
      runId: first.runId,
      nodeId: "start",
      floor: 1,
      stateVersion: 1,
    });
    expect(active?.state.map.seed).toBe(42);
  });

  test("keeps ownership, stale-version, completion, and leaderboard semantics explicit", async () => {
    const repository = createRepository();
    await repository.ensureAnonymousPlayer(playerId, "2026-08-26T00:00:00.000Z");
    await repository.ensureAnonymousPlayer(otherPlayerId, "2026-08-26T00:00:00.000Z");
    const record = createRecord(
      "00000000-0000-4000-8000-000000000103",
      "00000000-0000-4000-8000-000000000203",
    );
    await repository.createRun(record);

    expect(await repository.getOwnedRun(otherPlayerId, record.runId)).toBeNull();
    expect(await repository.saveCheckpoint({
      checkpointId: "00000000-0000-4000-8000-000000000204",
      playerId: otherPlayerId,
      runId: record.runId,
      expectedVersion: 1,
      nodeId: "1-1",
      floor: 1,
      state: record.state,
      stateHash: record.stateHash,
      timestamp: "2026-08-26T00:00:01.000Z",
    })).toBe("run_not_found");

    expect(await repository.saveCheckpoint({
      checkpointId: "00000000-0000-4000-8000-000000000205",
      playerId: playerId,
      runId: record.runId,
      expectedVersion: 2,
      nodeId: "1-1",
      floor: 1,
      state: record.state,
      stateHash: record.stateHash,
      timestamp: "2026-08-26T00:00:02.000Z",
    })).toBe("stale_state_version");

    expect(await repository.completeRun({
      playerId,
      runId: record.runId,
      input: { endReason: "cleared", score: 900, clearedFloor: 1, accuracy: 92 },
      timestamp: "2026-08-26T00:00:03.000Z",
    })).toBe("completed");
    expect(await repository.completeRun({
      playerId,
      runId: record.runId,
      input: { endReason: "cleared", score: 900, clearedFloor: 1, accuracy: 92 },
      timestamp: "2026-08-26T00:00:04.000Z",
    })).toBe("run_not_active");
    expect(await repository.getActiveRun(playerId)).toBeNull();
    expect(await repository.getLeaderboard(10)).toEqual([{
      rank: 1,
      score: 900,
      clearedFloor: 1,
      accuracy: 92,
      finalizedAt: "2026-08-26T00:00:03.000Z",
    }]);
  });

  test("returns stale_state_version when a concurrent checkpoint loses the optimistic update", async () => {
    const repository = createRepository();
    await repository.ensureAnonymousPlayer(playerId, "2026-08-26T00:00:00.000Z");
    const record = createRecord(
      "00000000-0000-4000-8000-000000000104",
      "00000000-0000-4000-8000-000000000204",
    );
    await repository.createRun(record);

    const checkpoint = (checkpointId: string) => repository.saveCheckpoint({
      checkpointId,
      playerId,
      runId: record.runId,
      expectedVersion: 1,
      nodeId: "1-1",
      floor: 1,
      state: record.state,
      stateHash: record.stateHash,
      timestamp: "2026-08-26T00:00:01.000Z",
    });
    const results = await Promise.allSettled([
      checkpoint("00000000-0000-4000-8000-000000000205"),
      checkpoint("00000000-0000-4000-8000-000000000206"),
    ]);

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(results.map((result) => result.status === "fulfilled" ? result.value : result.reason))
      .toEqual(["saved", "stale_state_version"]);
  });

  test("returns run_not_active when a concurrent completion loses the optimistic update", async () => {
    const repository = createRepository();
    await repository.ensureAnonymousPlayer(playerId, "2026-08-26T00:00:00.000Z");
    const record = createRecord(
      "00000000-0000-4000-8000-000000000105",
      "00000000-0000-4000-8000-000000000205",
    );
    await repository.createRun(record);
    const completion = {
      playerId,
      runId: record.runId,
      input: { endReason: "cleared" as const, score: 900, clearedFloor: 1, accuracy: 92 },
      timestamp: "2026-08-26T00:00:03.000Z",
    };

    const results = await Promise.allSettled([
      repository.completeRun(completion),
      repository.completeRun(completion),
    ]);

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(results.map((result) => result.status === "fulfilled" ? result.value : result.reason))
      .toEqual(["completed", "run_not_active"]);
  });
});

describe("Express API with the D1 repository", () => {
  test("preserves the run lifecycle contract and hides ownership", async () => {
    const repository = createRepository();
    const running = await listen(repository);
    activeServer = running.server;

    const createResponse = await fetch(`${running.baseUrl}/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seed: 42 }),
    });
    expect(createResponse.status).toBe(201);
    const setCookie = createResponse.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    const cookie = setCookie!.split(";", 1)[0]!;
    const created = await createResponse.json() as {
      runId: string;
      stateVersion: number;
      checkpoint: ReturnType<typeof createInitialRunState>;
    };

    const duplicateCreate = await fetch(`${running.baseUrl}/runs`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ seed: 42 }),
    });
    expect(duplicateCreate.status).toBe(409);
    expect(await duplicateCreate.json()).toEqual({ error: "active_run_exists" });

    const activeResponse = await fetch(`${running.baseUrl}/runs/active`, { headers: { cookie } });
    expect(activeResponse.status).toBe(200);
    expect((await activeResponse.json()).run).toMatchObject({
      runId: created.runId,
      stateVersion: 1,
      state: { map: { seed: 42, choicePath: [] } },
    });

    const checkpointState = {
      ...created.checkpoint,
      map: { ...created.checkpoint.map, currentRound: 1, choicePath: [1] },
    };
    const checkpointBody = {
      round: 1,
      choice: 1,
      stateVersion: 1,
      state: checkpointState,
    };
    const checkpointResponse = await fetch(`${running.baseUrl}/runs/${created.runId}/checkpoint`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(checkpointBody),
    });
    expect(checkpointResponse.status).toBe(200);
    expect((await checkpointResponse.json()).stateVersion).toBe(2);

    const staleResponse = await fetch(`${running.baseUrl}/runs/${created.runId}/checkpoint`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(checkpointBody),
    });
    expect(staleResponse.status).toBe(409);
    expect(await staleResponse.json()).toEqual({ error: "stale_state_version" });

    const wrongOwnerResponse = await fetch(`${running.baseUrl}/runs/${created.runId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endReason: "dead", score: 1, clearedFloor: 1 }),
    });
    expect(wrongOwnerResponse.status).toBe(404);
    expect(await wrongOwnerResponse.json()).toEqual({ error: "run_not_found" });

    const completeResponse = await fetch(`${running.baseUrl}/runs/${created.runId}/complete`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ endReason: "cleared", score: 900, clearedFloor: 1, accuracy: 92 }),
    });
    expect(completeResponse.status).toBe(200);

    const duplicateComplete = await fetch(`${running.baseUrl}/runs/${created.runId}/complete`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ endReason: "cleared", score: 900, clearedFloor: 1, accuracy: 92 }),
    });
    expect(duplicateComplete.status).toBe(409);
    expect(await duplicateComplete.json()).toEqual({ error: "run_not_active" });

    const leaderboardResponse = await fetch(`${running.baseUrl}/leaderboard?limit=20`, { headers: { cookie } });
    expect(leaderboardResponse.status).toBe(200);
    expect(await leaderboardResponse.json()).toEqual({
      entries: [{
        rank: 1,
        score: 900,
        clearedFloor: 1,
        accuracy: 92,
        finalizedAt: expect.any(String),
      }],
    });
  });

  test("keeps service validation at the API boundary", async () => {
    const repository = createRepository();
    await repository.ensureAnonymousPlayer(playerId, "2026-08-26T00:00:00.000Z");
    const service = createRunService(repository);
    const created = await service.createRun(playerId, 42);

    await expect(service.completeRun(playerId, created.runId, {
      endReason: "cleared",
      score: -1,
      clearedFloor: 1,
    })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  test("returns 400 for malformed JSON request bodies", async () => {
    const repository = createRepository();
    const running = await listen(repository);
    activeServer = running.server;

    const response = await fetch(`${running.baseUrl}/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{\"seed\":",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_json" });
  });
});
