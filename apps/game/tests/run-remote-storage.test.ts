import { describe, expect, test } from "bun:test";
import {
  RUN_REMOTE_COMPLETION_OUTBOX_STORAGE_KEY,
  RUN_REMOTE_METADATA_STORAGE_KEY,
  clearPendingRunCompletion,
  loadPendingRunCompletion,
  loadRunRemoteMetadata,
  savePendingRunCompletion,
  saveRunRemoteMetadata,
  type RunRemoteStorage,
} from "../src/game/run/run-remote-storage";

const createMemoryStorage = (): RunRemoteStorage & {
  has(key: string): boolean;
} => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    has: (key) => values.has(key),
  };
};

describe("remote run storage", () => {
  test("round-trips remote metadata and a pending completion", () => {
    const storage = createMemoryStorage();

    expect(saveRunRemoteMetadata({
      runId: "run-1",
      stateVersion: 3,
      mapId: "tower-v1",
      seed: 77,
    }, storage)).toBe(true);
    expect(loadRunRemoteMetadata(storage)).toEqual({
      runId: "run-1",
      stateVersion: 3,
      mapId: "tower-v1",
      seed: 77,
    });

    expect(savePendingRunCompletion({
      runId: "run-1",
      request: {
        endReason: "cleared",
        score: 700,
        clearedFloor: 10,
        accuracy: 98.5,
        resultSnapshot: { mapId: "default" },
      },
    }, storage)).toBe(true);
    expect(loadPendingRunCompletion(storage)).toEqual({
      runId: "run-1",
      request: {
        endReason: "cleared",
        score: 700,
        clearedFloor: 10,
        accuracy: 98.5,
        resultSnapshot: { mapId: "default" },
      },
    });

    clearPendingRunCompletion(storage);
    expect(loadPendingRunCompletion(storage)).toBeNull();
  });

  test("removes malformed records instead of retrying corrupt data", () => {
    const storage = createMemoryStorage();
    storage.setItem(RUN_REMOTE_METADATA_STORAGE_KEY, JSON.stringify({
      version: 1,
      runId: "run-1",
      stateVersion: 0,
    }));
    storage.setItem(RUN_REMOTE_COMPLETION_OUTBOX_STORAGE_KEY, JSON.stringify({
      version: 1,
      runId: "run-1",
      request: {
        endReason: "cleared",
        score: 10,
        clearedFloor: 1,
        accuracy: 101,
      },
    }));

    expect(loadRunRemoteMetadata(storage)).toBeNull();
    expect(loadPendingRunCompletion(storage)).toBeNull();
    expect(storage.has(RUN_REMOTE_METADATA_STORAGE_KEY)).toBe(false);
    expect(storage.has(RUN_REMOTE_COMPLETION_OUTBOX_STORAGE_KEY)).toBe(false);
  });
});
