import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import worker, { type WorkerEnv } from "../src/worker.ts";
import { asD1Database, MemoryD1Database } from "./support/memory-d1.ts";

const schema = readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8");

const createEnvironment = (): WorkerEnv => ({
  DB: asD1Database(new MemoryD1Database(schema)),
  API_ORIGIN: "https://api.example.test",
  COOKIE_SECURE: "false",
  CORS_ORIGIN: "https://game.example.test",
});

const fetchWorker = (
  env: WorkerEnv,
  path: string,
  init: RequestInit = {},
): Promise<Response> => worker.fetch(new Request(`https://api.example.test${path}`, init), env);

const json = async <T>(response: Response): Promise<T> => await response.json() as T;

const setCookieHeader = (response: Response): string => {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  return setCookie!;
};

const cookieValue = (response: Response): string => setCookieHeader(response).split(";", 1)[0]!;

const jsonHeaders = (cookie?: string): HeadersInit => ({
  ...(cookie ? { cookie } : {}),
  "content-type": "application/json",
  origin: "https://game.example.test",
});

describe("Cloudflare Worker API", () => {
  test("handles allowed CORS and rejects an unconfigured origin without touching D1", async () => {
    const env = createEnvironment();

    const preflight = await fetchWorker(env, "/runs", {
      method: "OPTIONS",
      headers: { origin: "https://game.example.test" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("https://game.example.test");
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");

    const health = await fetchWorker(env, "/health", {
      headers: { origin: "https://game.example.test" },
    });
    expect(health.status).toBe(200);
    expect(health.headers.get("access-control-allow-origin")).toBe("https://game.example.test");
    expect(await json(health)).toEqual({ status: "ok" });

    const denied = await fetchWorker(env, "/health", {
      headers: { origin: "https://evil.example.test" },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    expect(await json(denied)).toEqual({ error: "cors_origin_not_allowed" });
  });

  test("uses a cross-site-compatible cookie on HTTPS and a local cookie policy on HTTP", async () => {
    const httpsEnvironment = createEnvironment();
    httpsEnvironment.COOKIE_SECURE = "true";
    const httpsResponse = await fetchWorker(httpsEnvironment, "/runs", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ seed: 1 }),
    });
    expect(setCookieHeader(httpsResponse)).toMatch(/; HttpOnly; Secure; SameSite=None; Path=\/$/);

    const httpEnvironment = createEnvironment();
    httpEnvironment.COOKIE_SECURE = undefined;
    const httpResponse = await worker.fetch(new Request("http://api.example.test/runs", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ seed: 2 }),
    }), httpEnvironment);
    expect(setCookieHeader(httpResponse)).toMatch(/; HttpOnly; SameSite=Lax; Path=\/$/);
  });

  test("runs the direct Fetch lifecycle with cookie ownership and D1 state transitions", async () => {
    const env = createEnvironment();
    const createResponse = await fetchWorker(env, "/runs", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ seed: 42 }),
    });
    expect(createResponse.status).toBe(201);
    const cookie = cookieValue(createResponse);
    const created = await json<{
      runId: string;
      stateVersion: number;
      checkpoint: ReturnType<typeof createInitialRunState>;
    }>(createResponse);
    expect(created.stateVersion).toBe(1);
    expect(created.checkpoint.map.seed).toBe(42);

    const duplicateCreate = await fetchWorker(env, "/runs", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ seed: 42 }),
    });
    expect(duplicateCreate.status).toBe(409);
    expect(await json(duplicateCreate)).toEqual({ error: "active_run_exists" });

    const active = await fetchWorker(env, "/runs/active", {
      headers: { cookie, origin: "https://game.example.test" },
    });
    expect(active.status).toBe(200);
    expect((await json<{ run: { runId: string; stateVersion: number } | null }>(active)).run)
      .toMatchObject({ runId: created.runId, stateVersion: 1 });

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
    const checkpoint = await fetchWorker(env, `/runs/${created.runId}/checkpoint`, {
      method: "PUT",
      headers: jsonHeaders(cookie),
      body: JSON.stringify(checkpointBody),
    });
    expect(checkpoint.status).toBe(200);
    expect((await json<{ stateVersion: number }>(checkpoint)).stateVersion).toBe(2);

    const stale = await fetchWorker(env, `/runs/${created.runId}/checkpoint`, {
      method: "PUT",
      headers: jsonHeaders(cookie),
      body: JSON.stringify(checkpointBody),
    });
    expect(stale.status).toBe(409);
    expect(await json(stale)).toEqual({ error: "stale_state_version" });

    const invalidCheckpoint = await fetchWorker(env, `/runs/${created.runId}/checkpoint`, {
      method: "PUT",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({}),
    });
    expect(invalidCheckpoint.status).toBe(400);
    expect(await json(invalidCheckpoint)).toEqual({ error: "invalid_request" });

    const wrongOwner = await fetchWorker(env, `/runs/${created.runId}/complete`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ endReason: "dead", score: 1, clearedFloor: 1 }),
    });
    expect(wrongOwner.status).toBe(404);
    expect(await json(wrongOwner)).toEqual({ error: "run_not_found" });

    const complete = await fetchWorker(env, `/runs/${created.runId}/complete`, {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ endReason: "cleared", score: 900, clearedFloor: 1, accuracy: 92 }),
    });
    expect(complete.status).toBe(200);
    expect(await json(complete)).toMatchObject({ runId: created.runId });

    const duplicateComplete = await fetchWorker(env, `/runs/${created.runId}/complete`, {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ endReason: "cleared", score: 900, clearedFloor: 1, accuracy: 92 }),
    });
    expect(duplicateComplete.status).toBe(409);
    expect(await json(duplicateComplete)).toEqual({ error: "run_not_active" });

    const leaderboard = await fetchWorker(env, "/leaderboard?limit=20", {
      headers: { cookie, origin: "https://game.example.test" },
    });
    expect(leaderboard.status).toBe(200);
    expect(await json(leaderboard)).toEqual({
      entries: [{
        rank: 1,
        score: 900,
        clearedFloor: 1,
        accuracy: 92,
        finalizedAt: expect.any(String),
      }],
    });
  });

  test("maps malformed JSON and invalid completion input to the API error contract", async () => {
    const env = createEnvironment();
    const malformed = await fetchWorker(env, "/runs", {
      method: "POST",
      headers: jsonHeaders(),
      body: "{\"seed\":",
    });
    expect(malformed.status).toBe(400);
    expect(await json(malformed)).toEqual({ error: "invalid_json" });

    const createResponse = await fetchWorker(env, "/runs", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ seed: 7 }),
    });
    const cookie = cookieValue(createResponse);
    const created = await json<{ runId: string }>(createResponse);
    const invalidComplete = await fetchWorker(env, `/runs/${created.runId}/complete`, {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ endReason: "cleared", score: -1, clearedFloor: 1 }),
    });
    expect(invalidComplete.status).toBe(400);
    expect(await json(invalidComplete)).toEqual({ error: "invalid_request" });
  });

  test("rejects oversized JSON before parsing it", async () => {
    const response = await fetchWorker(createEnvironment(), "/runs", {
      method: "POST",
      headers: {
        ...jsonHeaders(),
        "content-length": "1048577",
      },
      body: "{}",
    });
    expect(response.status).toBe(413);
    expect(await json(response)).toEqual({ error: "payload_too_large" });

    const streamedResponse = await fetchWorker(createEnvironment(), "/runs", {
      method: "POST",
      headers: jsonHeaders(),
      body: "x".repeat(1_048_577),
    });
    expect(streamedResponse.status).toBe(413);
    expect(await json(streamedResponse)).toEqual({ error: "payload_too_large" });
  });

  test("serves OpenAPI with the configured API origin", async () => {
    const response = await fetchWorker(createEnvironment(), "/openapi.json");
    expect(response.status).toBe(200);
    expect((await json<{ servers: [{ url: string }] }>(response)).servers[0].url)
      .toBe("https://api.example.test");
  });
});
