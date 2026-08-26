import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import { RunSession } from "../src/game/run/run-session";
import {
  RUN_STORAGE_KEY,
  RUN_STORAGE_VERSION,
  loadSavedRun,
} from "../src/game/run/run-persistence";

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

describe("run persistence", () => {
  test("persists mutations and restores an active run", () => {
    const storage = createMemoryStorage();
    const first = new RunSession(storage);
    first.create({ seed: 77 });
    first.update((run) => ({ ...run, runCurrency: 25 }));

    const restored = new RunSession(storage).restore();
    expect(restored?.status).toBe("active");
    expect(restored?.runCurrency).toBe(25);
    expect(restored?.map.seed).toBe(77);
  });

  test("rejects corrupt and old-version data and removes it", () => {
    const storage = createMemoryStorage();
    storage.setItem(RUN_STORAGE_KEY, "not-json");
    expect(loadSavedRun(storage)).toBeNull();
    expect(storage.getItem(RUN_STORAGE_KEY)).toBeNull();

    storage.setItem(RUN_STORAGE_KEY, JSON.stringify({
      version: RUN_STORAGE_VERSION + 1,
      run: createInitialRunState({ seed: 1 }),
    }));
    expect(loadSavedRun(storage)).toBeNull();
    expect(storage.getItem(RUN_STORAGE_KEY)).toBeNull();
  });

  test.each(["dead", "cleared"] as const)(
    "persists a %s run until settlement is confirmed",
    (status) => {
      const storage = createMemoryStorage();
      const session = new RunSession(storage);
      session.create({ seed: status === "dead" ? 5 : 6 });
      session.end(status);

      expect(storage.getItem(RUN_STORAGE_KEY)).not.toBeNull();
      const restoredSession = new RunSession(storage);
      expect(restoredSession.restore()?.status).toBe(status);

      restoredSession.clear();
      expect(storage.getItem(RUN_STORAGE_KEY)).toBeNull();
    },
  );

  test("abandoning a run or clearing the session removes the save", () => {
    const storage = createMemoryStorage();
    const session = new RunSession(storage);
    session.create({ seed: 5 });
    expect(storage.getItem(RUN_STORAGE_KEY)).not.toBeNull();
    session.end("abandoned");
    expect(storage.getItem(RUN_STORAGE_KEY)).toBeNull();

    session.create({ seed: 6 });
    session.clear();
    expect(storage.getItem(RUN_STORAGE_KEY)).toBeNull();
  });
});
