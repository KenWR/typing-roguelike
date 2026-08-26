import { RUN_STATE_SCHEMA_VERSION, type RunState } from "@typing-roguelike/shared";

export const RUN_STORAGE_KEY = "typing-roguelike.active-run";
export const RUN_STORAGE_VERSION = 1;

export type RunStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type PersistedRunEnvelope = Readonly<{
  version: number;
  run: RunState;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRunState = (value: unknown): value is RunState => {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== RUN_STATE_SCHEMA_VERSION) return false;
  if (value.status !== "active") return false;
  if (!isRecord(value.character) || typeof value.character.currentHp !== "number" || typeof value.character.maxHp !== "number") return false;
  if (!isRecord(value.inventory) || !Array.isArray(value.inventory.itemInstances) || !Array.isArray(value.inventory.relicInstances)) return false;
  if (!isRecord(value.loadout) || !isRecord(value.build) || !Array.isArray(value.build.equippedRelicIds)) return false;
  if (!isRecord(value.map)) return false;
  if (typeof value.map.mapId !== "string" || typeof value.map.seed !== "number" || typeof value.map.currentNodeId !== "string") return false;
  if (typeof value.map.currentRound !== "number" || !Array.isArray(value.map.choicePath) || !isRecord(value.map.nodeStatuses)) return false;
  return typeof value.acquiredItemValue === "number" && typeof value.runCurrency === "number";
};

export const saveRunState = (run: Readonly<RunState>, storage?: RunStorage): void => {
  if (!storage || run.status !== "active") return;
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
    return parsed.run;
  } catch {
    clearSavedRun(storage);
    return null;
  }
};

export const getBrowserRunStorage = (): RunStorage | undefined =>
  typeof localStorage === "undefined" ? undefined : localStorage;
