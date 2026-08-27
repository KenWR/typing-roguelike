import {
  MAP_ROUND_COUNT,
  RUN_STATE_SCHEMA_VERSION,
  generateNodeChoices,
  getMapNodeKey,
  type RunState,
} from "@typing-roguelike/shared";

export const RUN_STORAGE_KEY = "typing-roguelike.active-run";
export const RUN_STORAGE_VERSION = 1;

export type RunStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type PersistedRunEnvelope = Readonly<{
  version: number;
  run: RunState;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPersistedRunStatus = (
  value: unknown,
): value is Extract<RunState["status"], "active" | "dead" | "cleared"> =>
  value === "active" || value === "dead" || value === "cleared";

const isRunState = (value: unknown): value is RunState => {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== RUN_STATE_SCHEMA_VERSION) return false;
  if (!isPersistedRunStatus(value.status)) return false;
  if (!isRecord(value.character) || typeof value.character.currentHp !== "number" || typeof value.character.maxHp !== "number") return false;
  if (!isRecord(value.inventory) || !Array.isArray(value.inventory.itemInstances) || !Array.isArray(value.inventory.relicInstances)) return false;
  if (!isRecord(value.loadout) || !isRecord(value.build) || !Array.isArray(value.build.equippedRelicIds)) return false;
  if (!isRecord(value.map)) return false;
  if (typeof value.map.mapId !== "string" || typeof value.map.seed !== "number" || typeof value.map.currentNodeId !== "string") return false;
  if (typeof value.map.currentRound !== "number" || !Array.isArray(value.map.choicePath) || !isRecord(value.map.nodeStatuses)) return false;
  return typeof value.acquiredItemValue === "number" && typeof value.runCurrency === "number";
};

/**
 * Repairs legacy active checkpoints that cleared a node but persisted before the
 * map round advanced. Local and remote restore paths both use this function.
 */
export const normalizeRestoredRunState = (state: Readonly<RunState>): RunState => {
  if (state.status !== "active") return state as RunState;

  const map = state.map;
  const currentStatus = map.nodeStatuses[map.currentNodeId];
  const statuses = Object.values(map.nodeStatuses);
  if (
    currentStatus !== "cleared" ||
    map.currentRound >= MAP_ROUND_COUNT ||
    statuses.includes("available") ||
    statuses.includes("in_progress")
  ) {
    return state as RunState;
  }

  try {
    let nextChoicePath: number[];
    if (map.choicePath.length === map.currentRound) {
      if (getMapNodeKey(map.currentRound, map.choicePath) !== map.currentNodeId) {
        return state as RunState;
      }
      nextChoicePath = [...map.choicePath];
    } else if (map.choicePath.length === map.currentRound - 1) {
      const clearedNode = generateNodeChoices(
        map.seed,
        map.currentRound,
        map.choicePath,
      ).find((node) => node.key === map.currentNodeId);
      if (clearedNode === undefined) return state as RunState;
      nextChoicePath = [...map.choicePath, clearedNode.choice];
    } else {
      return state as RunState;
    }

    const nextRound = map.currentRound + 1;
    const nextNodes = generateNodeChoices(map.seed, nextRound, nextChoicePath);
    const nodeStatuses = { ...map.nodeStatuses };
    let recoveredAvailableNode = false;

    for (const node of nextNodes) {
      const status = nodeStatuses[node.key];
      if (status === undefined || status === "locked") {
        nodeStatuses[node.key] = "available";
        recoveredAvailableNode = true;
      }
    }

    if (!recoveredAvailableNode) return state as RunState;

    return {
      ...state,
      map: {
        ...map,
        currentRound: nextRound,
        choicePath: nextChoicePath,
        nodeStatuses,
      },
    };
  } catch {
    return state as RunState;
  }
};

export const saveRunState = (run: Readonly<RunState>, storage?: RunStorage): void => {
  if (!storage || !isPersistedRunStatus(run.status)) return;
  const envelope: PersistedRunEnvelope = { version: RUN_STORAGE_VERSION, run: run as RunState };
  try {
    storage.setItem(RUN_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Runtime session remains usable even when browser storage is unavailable.
  }
};

export const clearSavedRun = (storage?: Pick<RunStorage, "removeItem">): void => {
  if (!storage) return;
  try {
    storage.removeItem(RUN_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
};

export const loadSavedRun = (storage?: Pick<RunStorage, "getItem" | "removeItem">): RunState | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RUN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== RUN_STORAGE_VERSION || !isRunState(parsed.run)) {
      clearSavedRun(storage);
      return null;
    }
    return normalizeRestoredRunState(parsed.run);
  } catch {
    clearSavedRun(storage);
    return null;
  }
};

export const getBrowserRunStorage = (): RunStorage | undefined =>
  typeof localStorage === "undefined" ? undefined : localStorage;
