import { describe, expect, test } from "bun:test";
import { RunApiClient, RunApiError, type FetchLike } from "../src/game/api/run-api-client";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("RunApiClient", () => {
  test("starts a run with credentials and the configured base URL", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return jsonResponse({
        runId: "run-1",
        stateVersion: 1,
        checkpoint: { map: { seed: 77 } },
        nodeChoices: [],
      }, 201);
    };
    const client = new RunApiClient("https://api.example.test", fetchImpl);

    await client.createRun(77);

    expect(String(calls[0]?.input)).toBe("https://api.example.test/runs");
    expect(calls[0]?.init?.credentials).toBe("include");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ seed: 77 }));
  });

  test("retries a transient network failure once", async () => {
    let attempts = 0;
    const fetchImpl: FetchLike = async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("offline");
      return jsonResponse({ run: null });
    };
    const client = new RunApiClient("http://localhost:3000", fetchImpl, 50, 2);

    await client.getActiveRun();

    expect(attempts).toBe(2);
  });

  test("preserves API conflict codes for active run handling", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse({ error: "active_run_exists" }, 409);
    const client = new RunApiClient("http://localhost:3000", fetchImpl);

    try {
      await client.createRun(1);
      throw new Error("expected createRun to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RunApiError);
      expect((error as RunApiError).status).toBe(409);
      expect((error as RunApiError).code).toBe("active_run_exists");
    }
  });
});
