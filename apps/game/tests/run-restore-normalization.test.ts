import { describe, expect, test } from "bun:test";
import {
  MAP_ROUND_COUNT,
  createInitialRunState,
  generateNodeChoices,
  type RunState,
} from "@typing-roguelike/shared";
import { RunApiClient } from "../src/game/api/run-api-client";
import {
  RUN_STORAGE_KEY,
  RUN_STORAGE_VERSION,
  loadSavedRun,
  normalizeRestoredRunState,
} from "../src/game/run/run-persistence";
import { RunRemotePersistence } from "../src/game/run/run-remote-persistence";
import { initializeRunMap } from "../src/game/run/run-start-map";

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

const createSoftlockedRun = (seed = 77): RunState => {
  const initial = initializeRunMap(createInitialRunState({ seed }));
  const firstRound = generateNodeChoices(seed, 1, []);
  const clearedNode = firstRound[2]!;

  return {
    ...initial,
    map: {
      ...initial.map,
      currentNodeId: clearedNode.key,
      currentRound: 1,
      choicePath: [clearedNode.choice],
      nodeStatuses: Object.fromEntries(
        firstRound.map((node) => [node.key, node.key === clearedNode.key ? "cleared" : "locked"]),
      ),
    },
  };
};

const availableNodeIds = (run: Readonly<RunState>): string[] =>
  Object.entries(run.map.nodeStatuses)
    .filter(([, status]) => status === "available")
    .map(([nodeId]) => nodeId);

describe("run restore normalization", () => {
  test("repairs a legacy cleared checkpoint through local storage", () => {
    const storage = createMemoryStorage();
    const softlocked = createSoftlockedRun();
    storage.setItem(RUN_STORAGE_KEY, JSON.stringify({
      version: RUN_STORAGE_VERSION,
      run: softlocked,
    }));

    const restored = loadSavedRun(storage);
    expect(restored?.map.currentRound).toBe(2);
    expect(restored?.map.choicePath).toEqual(softlocked.map.choicePath);
    expect(availableNodeIds(restored!)).toEqual(
      generateNodeChoices(softlocked.map.seed, 2, softlocked.map.choicePath).map((node) => node.key),
    );
  });

  test("uses the same cleared-checkpoint normalization for server restores", async () => {
    const softlocked = createSoftlockedRun(88);
    const api = new RunApiClient("http://test", async () => new Response(JSON.stringify({
      run: {
        runId: "run-1",
        nodeId: softlocked.map.currentNodeId,
        floor: 1,
        state: softlocked,
        stateVersion: 4,
        savedAt: "2026-08-26T00:00:00.000Z",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }), 100, 1);

    const restored = await new RunRemotePersistence(api).restore(null);
    expect(restored?.map.currentRound).toBe(2);
    expect(availableNodeIds(restored!)).toEqual(
      generateNodeChoices(softlocked.map.seed, 2, softlocked.map.choicePath).map((node) => node.key),
    );
  });

  test("does not change a normal active map with available choices", () => {
    const normal = initializeRunMap(createInitialRunState({ seed: 12 }));
    expect(normalizeRestoredRunState(normal)).toEqual(normal);
  });

  test("does not change an in-progress node", () => {
    const initial = initializeRunMap(createInitialRunState({ seed: 13 }));
    const selected = generateNodeChoices(13, 1, [])[0]!;
    const inProgress: RunState = {
      ...initial,
      map: {
        ...initial.map,
        currentNodeId: selected.key,
        nodeStatuses: Object.fromEntries(
          generateNodeChoices(13, 1, []).map((node) => [
            node.key,
            node.key === selected.key ? "in_progress" : "locked",
          ]),
        ),
      },
    };

    expect(normalizeRestoredRunState(inProgress)).toEqual(inProgress);
  });

  test("does not advance a cleared final boss checkpoint", () => {
    const seed = 14;
    const prefix = Array.from({ length: MAP_ROUND_COUNT - 1 }, () => 1);
    const boss = generateNodeChoices(seed, MAP_ROUND_COUNT, prefix)[0]!;
    const finalRun: RunState = {
      ...createInitialRunState({ seed }),
      map: {
        ...createInitialRunState({ seed }).map,
        currentNodeId: boss.key,
        currentRound: MAP_ROUND_COUNT,
        choicePath: [...prefix, boss.choice],
        nodeStatuses: { [boss.key]: "cleared" },
      },
    };

    expect(normalizeRestoredRunState(finalRun)).toEqual(finalRun);
    expect(availableNodeIds(finalRun)).toEqual([]);
  });
});
