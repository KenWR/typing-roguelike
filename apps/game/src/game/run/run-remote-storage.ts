import type { CompleteRunRequest } from "@typing-roguelike/shared";

export const RUN_REMOTE_METADATA_STORAGE_KEY =
  "typing-roguelike.remote-run-metadata";
export const RUN_REMOTE_COMPLETION_OUTBOX_STORAGE_KEY =
  "typing-roguelike.remote-run-completion-outbox";
const RUN_REMOTE_STORAGE_VERSION = 1;

export type RunRemoteStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type RunRemoteMetadata = Readonly<{
  runId: string;
  stateVersion: number;
  mapId: string;
  seed: number;
}>;

export type PendingRunCompletion = Readonly<{
  runId: string;
  request: CompleteRunRequest;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

const isRunEndReason = (
  value: unknown,
): value is CompleteRunRequest["endReason"] =>
  value === "dead" || value === "cleared" || value === "abandoned";

const isCompleteRunRequest = (value: unknown): value is CompleteRunRequest =>
  isRecord(value) &&
  isRunEndReason(value.endReason) &&
  isNonNegativeSafeInteger(value.score) &&
  isNonNegativeSafeInteger(value.clearedFloor) &&
  (value.accuracy === undefined ||
    (typeof value.accuracy === "number" &&
      Number.isFinite(value.accuracy) &&
      value.accuracy >= 0 &&
      value.accuracy <= 100)) &&
  (value.resultSnapshot === undefined || isRecord(value.resultSnapshot));

const readStoredValue = (
  key: string,
  storage?: Pick<RunRemoteStorage, "getItem" | "removeItem">,
): unknown => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    try {
      storage.removeItem(key);
    } catch {}
    return null;
  }
};

const removeStoredValue = (
  key: string,
  storage?: Pick<RunRemoteStorage, "removeItem">,
): void => {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {}
};

export const loadRunRemoteMetadata = (
  storage?: Pick<RunRemoteStorage, "getItem" | "removeItem">,
): RunRemoteMetadata | null => {
  const value = readStoredValue(RUN_REMOTE_METADATA_STORAGE_KEY, storage);
  if (
    !isRecord(value) ||
    value.version !== RUN_REMOTE_STORAGE_VERSION ||
    !isNonEmptyString(value.runId) ||
    !isPositiveSafeInteger(value.stateVersion) ||
    !isNonEmptyString(value.mapId) ||
    !isNonNegativeSafeInteger(value.seed)
  ) {
    if (value !== null) clearRunRemoteMetadata(storage);
    return null;
  }
  return {
    runId: value.runId,
    stateVersion: value.stateVersion,
    mapId: value.mapId,
    seed: value.seed,
  };
};

export const saveRunRemoteMetadata = (
  metadata: RunRemoteMetadata,
  storage?: Pick<RunRemoteStorage, "setItem">,
): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(RUN_REMOTE_METADATA_STORAGE_KEY, JSON.stringify({
      version: RUN_REMOTE_STORAGE_VERSION,
      ...metadata,
    }));
    return true;
  } catch {
    return false;
  }
};

export const clearRunRemoteMetadata = (
  storage?: Pick<RunRemoteStorage, "removeItem">,
): void => removeStoredValue(RUN_REMOTE_METADATA_STORAGE_KEY, storage);

export const loadPendingRunCompletion = (
  storage?: Pick<RunRemoteStorage, "getItem" | "removeItem">,
): PendingRunCompletion | null => {
  const value = readStoredValue(
    RUN_REMOTE_COMPLETION_OUTBOX_STORAGE_KEY,
    storage,
  );
  if (
    !isRecord(value) ||
    value.version !== RUN_REMOTE_STORAGE_VERSION ||
    !isNonEmptyString(value.runId) ||
    !isCompleteRunRequest(value.request)
  ) {
    if (value !== null) clearPendingRunCompletion(storage);
    return null;
  }
  return { runId: value.runId, request: value.request };
};

export const savePendingRunCompletion = (
  pending: PendingRunCompletion,
  storage?: Pick<RunRemoteStorage, "setItem">,
): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(
      RUN_REMOTE_COMPLETION_OUTBOX_STORAGE_KEY,
      JSON.stringify({ version: RUN_REMOTE_STORAGE_VERSION, ...pending }),
    );
    return true;
  } catch {
    return false;
  }
};

export const clearPendingRunCompletion = (
  storage?: Pick<RunRemoteStorage, "removeItem">,
): void => removeStoredValue(RUN_REMOTE_COMPLETION_OUTBOX_STORAGE_KEY, storage);

export const getBrowserRunRemoteStorage = (): RunRemoteStorage | undefined =>
  typeof localStorage === "undefined" ? undefined : localStorage;
