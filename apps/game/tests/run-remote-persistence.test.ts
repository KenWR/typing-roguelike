import { describe, expect, test } from "bun:test";
import {
  beginMapNode,
  createInitialRunState,
  EQUIPMENT_CONFIGS,
  generateNodeChoices,
  type CheckpointRequest,
  type CompleteRunRequest,
  type RunState,
} from "@typing-roguelike/shared";
import { RunApiClient } from "../src/game/api/run-api-client";
import { RunRemotePersistence } from "../src/game/run/run-remote-persistence";
import {
  loadPendingRunCompletion,
  loadRunRemoteMetadata,
  type RunRemoteStorage,
} from "../src/game/run/run-remote-storage";
import { initializeRunMap } from "../src/game/run/run-start-map";

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const createMemoryStorage = (): RunRemoteStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

const createUnavailableStorage = (): RunRemoteStorage => ({
  getItem: () => null,
  setItem: () => {
    throw new Error("storage_unavailable");
  },
  removeItem: () => {},
});

describe("remote run persistence", () => {
  test("serializes overlapping checkpoints so each uses the saved state version", async () => {
    const initial = createInitialRunState({ seed: 1234 });
    const checkpointRequests: CheckpointRequest[] = [];
    let releaseFirstCheckpoint!: () => void;
    let markFirstCheckpointStarted!: () => void;
    const firstCheckpointGate = new Promise<void>((resolve) => {
      releaseFirstCheckpoint = resolve;
    });
    const firstCheckpointStarted = new Promise<void>((resolve) => {
      markFirstCheckpointStarted = resolve;
    });

    const api = new RunApiClient("http://test", async (input, init) => {
      const url = String(input);
      if (url.endsWith("/runs") && init?.method === "POST") {
        return jsonResponse({
          runId: "run-queue",
          stateVersion: 1,
          checkpoint: initial,
          nodeChoices: [],
        });
      }

      const request = JSON.parse(String(init?.body)) as CheckpointRequest;
      checkpointRequests.push(request);
      if (checkpointRequests.length === 1) {
        markFirstCheckpointStarted();
        await firstCheckpointGate;
      }
      return jsonResponse({
        stateVersion: request.stateVersion + 1,
        savedAt: "2026-08-26T00:00:00.000Z",
        nodeChoices: [],
      });
    }, 1_000, 1);
    const persistence = new RunRemotePersistence(api, createUnavailableStorage());
    const started = await persistence.start(initial.map.seed) as RunState;
    const selected = generateNodeChoices(
      started.map.seed,
      started.map.currentRound,
      started.map.choicePath,
    )[0]!;
    const selectedRun: RunState = {
      ...started,
      map: beginMapNode(started.map, selected.key),
    };

    const first = persistence.checkpoint(selectedRun);
    const second = persistence.checkpoint(selectedRun);
    await firstCheckpointStarted;
    expect(checkpointRequests.map(({ stateVersion }) => stateVersion)).toEqual([1]);

    releaseFirstCheckpoint();
    await Promise.all([first, second]);
    expect(checkpointRequests.map(({ stateVersion }) => stateVersion)).toEqual([1, 2]);
  });

  test("waits for an in-flight checkpoint before completing the same run", async () => {
    const initial = createInitialRunState({ seed: 2222 });
    const requestOrder: string[] = [];
    let releaseCheckpoint!: () => void;
    let markCheckpointStarted!: () => void;
    const checkpointGate = new Promise<void>((resolve) => {
      releaseCheckpoint = resolve;
    });
    const checkpointStarted = new Promise<void>((resolve) => {
      markCheckpointStarted = resolve;
    });
    const api = new RunApiClient("http://test", async (input, init) => {
      const url = String(input);
      if (url.endsWith("/runs") && init?.method === "POST") {
        return jsonResponse({
          runId: "run-lifecycle-queue",
          stateVersion: 1,
          checkpoint: initial,
          nodeChoices: [],
        });
      }
      if (url.endsWith("/checkpoint") && init?.method === "PUT") {
        requestOrder.push("checkpoint-started");
        markCheckpointStarted();
        await checkpointGate;
        requestOrder.push("checkpoint-finished");
        return jsonResponse({
          stateVersion: 2,
          savedAt: "2026-08-26T00:00:00.000Z",
          nodeChoices: [],
        });
      }
      if (url.endsWith("/complete") && init?.method === "POST") {
        requestOrder.push("completion");
        return jsonResponse({
          runId: "run-lifecycle-queue",
          finalizedAt: "2026-08-26T00:00:00.000Z",
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }, 1_000, 1);
    const persistence = new RunRemotePersistence(api, createMemoryStorage());
    const started = await persistence.start(initial.map.seed) as RunState;
    const selected = generateNodeChoices(
      started.map.seed,
      started.map.currentRound,
      started.map.choicePath,
    )[0]!;
    const selectedRun: RunState = {
      ...started,
      map: beginMapNode(started.map, selected.key),
    };

    const checkpointPromise = persistence.checkpoint(selectedRun);
    await checkpointStarted;
    const completionPromise = persistence.complete({
      ...selectedRun,
      status: "dead",
    });
    await Promise.resolve();
    expect(requestOrder).toEqual(["checkpoint-started"]);

    releaseCheckpoint();
    expect(await completionPromise).toBe(true);
    await checkpointPromise;
    expect(requestOrder).toEqual([
      "checkpoint-started",
      "checkpoint-finished",
      "completion",
    ]);
  });

  test("keeps a failed server completion retryable before clearing the run", async () => {
    const initial = createInitialRunState({ seed: 4321 });
    let completeAttempts = 0;
    const api = new RunApiClient("http://test", async (input, init) => {
      const url = String(input);
      if (url.endsWith("/runs") && init?.method === "POST") {
        return jsonResponse({
          runId: "run-complete",
          stateVersion: 1,
          checkpoint: initial,
          nodeChoices: [],
        });
      }

      completeAttempts += 1;
      if (completeAttempts === 1) {
        return new Response(JSON.stringify({ error: "temporary_failure" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return jsonResponse({
        runId: "run-complete",
        finalizedAt: "2026-08-26T00:00:00.000Z",
      });
    }, 1_000, 1);
    const persistence = new RunRemotePersistence(api, createUnavailableStorage());
    await persistence.start(initial.map.seed);
    const terminal: RunState = { ...initial, status: "dead" };

    expect(await persistence.complete(terminal)).toBe(false);
    expect(persistence.syncStatus.mode).toBe("local_fallback");
    expect(await persistence.complete(terminal)).toBe(true);
    expect(completeAttempts).toBe(2);
  });

  test("restores the remote run identity after a reload before completing", async () => {
    const initial = createInitialRunState({ seed: 2468 });
    const storage = createMemoryStorage();
    const completionRequests: CompleteRunRequest[] = [];
    const api = new RunApiClient("http://test", async (input, init) => {
      const url = String(input);
      if (url.endsWith("/runs") && init?.method === "POST") {
        return jsonResponse({
          runId: "run-reloaded",
          stateVersion: 1,
          checkpoint: initial,
          nodeChoices: [],
        });
      }
      if (url.endsWith("/runs/run-reloaded/complete")) {
        completionRequests.push(JSON.parse(String(init?.body)) as CompleteRunRequest);
        return jsonResponse({
          runId: "run-reloaded",
          finalizedAt: "2026-08-26T00:00:00.000Z",
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }, 1_000, 1);

    const beforeReload = new RunRemotePersistence(api, storage);
    await beforeReload.start(initial.map.seed);
    expect(loadRunRemoteMetadata(storage)).toEqual({
      runId: "run-reloaded",
      stateVersion: 1,
      mapId: initial.map.mapId,
      seed: initial.map.seed,
    });

    const afterReload = new RunRemotePersistence(api, storage);
    const equipment = EQUIPMENT_CONFIGS[0]!;
    expect(await afterReload.complete({
      ...initial,
      status: "dead",
      runCurrency: 12,
      inventory: {
        ...initial.inventory,
        itemInstances: [equipment.id],
      },
    })).toBe(true);
    expect(completionRequests).toHaveLength(1);
    expect(completionRequests[0]).toMatchObject({
      score: equipment.sellValue + 12,
      resultSnapshot: { acquiredItemValue: equipment.sellValue },
    });
    expect(loadRunRemoteMetadata(storage)).toBeNull();
  });

  test("does not complete a persisted remote id with an unrelated local run", async () => {
    const remoteRun = createInitialRunState({ seed: 8642 });
    const storage = createMemoryStorage();
    let completionAttempts = 0;
    const api = new RunApiClient("http://test", async (input, init) => {
      const url = String(input);
      if (url.endsWith("/runs") && init?.method === "POST") {
        return jsonResponse({
          runId: "run-identity",
          stateVersion: 1,
          checkpoint: remoteRun,
          nodeChoices: [],
        });
      }
      if (url.endsWith("/complete")) {
        completionAttempts += 1;
      }
      throw new Error(`unexpected request: ${url}`);
    }, 1_000, 1);

    await new RunRemotePersistence(api, storage).start(remoteRun.map.seed);
    const afterReload = new RunRemotePersistence(api, storage);
    const unrelatedLocalRun: RunState = {
      ...createInitialRunState({ seed: remoteRun.map.seed + 1 }),
      status: "dead",
    };

    expect(await afterReload.complete(unrelatedLocalRun)).toBe(true);
    expect(completionAttempts).toBe(0);
    expect(loadRunRemoteMetadata(storage)).toBeNull();
  });

  test("queues a failed completion and flushes it on the next server sync", async () => {
    const initial = createInitialRunState({ seed: 1357 });
    const storage = createMemoryStorage();
    let serverAvailable = false;
    let completionAttempts = 0;
    const api = new RunApiClient("http://test", async (input, init) => {
      const url = String(input);
      if (url.endsWith("/runs") && init?.method === "POST") {
        return jsonResponse({
          runId: "run-outbox",
          stateVersion: 1,
          checkpoint: initial,
          nodeChoices: [],
        });
      }
      if (url.endsWith("/runs/run-outbox/complete")) {
        completionAttempts += 1;
        if (!serverAvailable) {
          return new Response(JSON.stringify({ error: "temporary_failure" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        return jsonResponse({
          runId: "run-outbox",
          finalizedAt: "2026-08-26T00:00:00.000Z",
        });
      }
      if (url.endsWith("/runs/active") && init?.method === "GET") {
        return jsonResponse({ run: null });
      }
      throw new Error(`unexpected request: ${url}`);
    }, 1_000, 1);

    const firstSession = new RunRemotePersistence(api, storage);
    await firstSession.start(initial.map.seed);
    expect(await firstSession.complete({ ...initial, status: "cleared" })).toBe(true);
    expect(loadPendingRunCompletion(storage)?.runId).toBe("run-outbox");
    expect(loadRunRemoteMetadata(storage)).toBeNull();

    serverAvailable = true;
    const nextSession = new RunRemotePersistence(api, storage);
    expect(await nextSession.restore(null)).toBeNull();
    expect(completionAttempts).toBe(2);
    expect(loadPendingRunCompletion(storage)).toBeNull();
  });

  test("keeps later runs local while a previous server completion is still pending", async () => {
    const initial = createInitialRunState({ seed: 7531 });
    const storage = createMemoryStorage();
    let createAttempts = 0;
    let activeRunRequests = 0;
    const api = new RunApiClient("http://test", async (input, init) => {
      const url = String(input);
      if (url.endsWith("/runs") && init?.method === "POST") {
        createAttempts += 1;
        return jsonResponse({
          runId: "run-still-pending",
          stateVersion: 1,
          checkpoint: initial,
          nodeChoices: [],
        });
      }
      if (url.endsWith("/complete")) {
        return new Response(JSON.stringify({ error: "temporary_failure" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/runs/active")) {
        activeRunRequests += 1;
        return jsonResponse({ run: null });
      }
      throw new Error(`unexpected request: ${url}`);
    }, 1_000, 1);

    const firstSession = new RunRemotePersistence(api, storage);
    await firstSession.start(initial.map.seed);
    expect(await firstSession.complete({ ...initial, status: "dead" })).toBe(true);
    expect(loadPendingRunCompletion(storage)?.runId).toBe("run-still-pending");

    const nextSession = new RunRemotePersistence(api, storage);
    expect(await nextSession.start(initial.map.seed + 1)).toBeNull();
    expect(await nextSession.restore(null)).toBeNull();
    expect(createAttempts).toBe(1);
    expect(activeRunRequests).toBe(0);
    expect(loadPendingRunCompletion(storage)?.runId).toBe("run-still-pending");
  });

  test("preserves an existing remote run identity when creating a run is temporarily unavailable", async () => {
    const initial = createInitialRunState({ seed: 8520 });
    const storage = createMemoryStorage();
    let serverAvailable = true;
    const api = new RunApiClient("http://test", async (input, init) => {
      const url = String(input);
      if (url.endsWith("/runs") && init?.method === "POST") {
        if (!serverAvailable) {
          return new Response(JSON.stringify({ error: "temporary_failure" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        return jsonResponse({
          runId: "run-preserved",
          stateVersion: 1,
          checkpoint: initial,
          nodeChoices: [],
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }, 1_000, 1);

    await new RunRemotePersistence(api, storage).start(initial.map.seed);
    serverAvailable = false;
    expect(
      await new RunRemotePersistence(api, storage).start(initial.map.seed + 1),
    ).toBeNull();
    expect(loadRunRemoteMetadata(storage)?.runId).toBe("run-preserved");
  });

  test("does not poison the completion outbox with a permanent request error", async () => {
    const initial = createInitialRunState({ seed: 9753 });
    const storage = createMemoryStorage();
    const api = new RunApiClient("http://test", async (input, init) => {
      const url = String(input);
      if (url.endsWith("/runs") && init?.method === "POST") {
        return jsonResponse({
          runId: "run-invalid-completion",
          stateVersion: 1,
          checkpoint: initial,
          nodeChoices: [],
        });
      }
      if (url.endsWith("/complete")) {
        return new Response(JSON.stringify({ error: "invalid_request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }, 1_000, 1);
    const persistence = new RunRemotePersistence(api, storage);
    await persistence.start(initial.map.seed);

    expect(await persistence.complete({ ...initial, status: "dead" })).toBe(false);
    expect(loadPendingRunCompletion(storage)).toBeNull();
    expect(loadRunRemoteMetadata(storage)?.runId).toBe("run-invalid-completion");
  });

  test("treats completion as successful when the run is local-only", async () => {
    const persistence = new RunRemotePersistence(
      undefined,
      createUnavailableStorage(),
    );
    const terminal: RunState = {
      ...createInitialRunState({ seed: 999 }),
      status: "dead",
    };

    expect(await persistence.complete(terminal)).toBe(true);
  });
});
