import {
  generateNodeChoices,
  getMapNodeKey,
  type CheckpointRequest,
  type CompleteRunRequest,
  type RunState,
} from "@typing-roguelike/shared";
import { RunApiError, runApiClient, type RunApiClient } from "../api/run-api-client";
import { calculateRunEquipmentExchangeValue } from "../settlement/equipment-exchange";
import { normalizeRestoredRunState } from "./run-persistence";
import {
  clearPendingRunCompletion,
  clearRunRemoteMetadata,
  getBrowserRunRemoteStorage,
  loadPendingRunCompletion,
  loadRunRemoteMetadata,
  savePendingRunCompletion,
  saveRunRemoteMetadata,
  type RunRemoteMetadata,
  type RunRemoteStorage,
} from "./run-remote-storage";
import { ensurePlayableRunLoadout, runSession } from "./run-session";
import { initializeRunMap } from "./run-start-map";

export type RunSyncMode =
  | "idle"
  | "syncing"
  | "synced"
  | "local_fallback"
  | "conflict_resolved";

export type RunSyncStatus = Readonly<{
  mode: RunSyncMode;
  message: string;
}>;

const normalizeServerState = (state: Readonly<RunState>): RunState => {
  let normalized = ensurePlayableRunLoadout(state);

  if (
    normalized.map.currentNodeId === "start" &&
    Object.keys(normalized.map.nodeStatuses).length === 0
  ) {
    normalized = initializeRunMap(normalized);
  }

  if (
    normalized.map.choicePath.length === normalized.map.currentRound &&
    getMapNodeKey(normalized.map.currentRound, normalized.map.choicePath) ===
      normalized.map.currentNodeId
  ) {
    normalized = {
      ...normalized,
      map: {
        ...normalized.map,
        choicePath: normalized.map.choicePath.slice(0, -1),
      },
    };
  }

  return normalizeRestoredRunState(normalized);
};

const hasSameRunIdentity = (
  first: Readonly<RunState>,
  second: Readonly<RunState>,
): boolean =>
  first.map.mapId === second.map.mapId &&
  first.map.seed === second.map.seed;

const isRetryableCompletionError = (error: unknown): boolean =>
  !(error instanceof RunApiError) ||
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500;

/**
 * The server currently stores a node-entry checkpoint, while the browser saves
 * mutations made inside and immediately after that node. Keep the browser copy
 * when it is observably at least as far through the same run, otherwise a page
 * refresh can undo combat rewards, shop purchases, healing, or a terminal result.
 */
export const preferLocalRunState = (
  serverState: Readonly<RunState>,
  localState: Readonly<RunState> | null,
): RunState => {
  if (localState === null || !hasSameRunIdentity(serverState, localState)) {
    return serverState as RunState;
  }

  if (localState.status !== "active") {
    return localState as RunState;
  }

  if (serverState.status !== "active") {
    return serverState as RunState;
  }

  if (localState.map.currentRound !== serverState.map.currentRound) {
    return localState.map.currentRound > serverState.map.currentRound
      ? localState as RunState
      : serverState as RunState;
  }

  if (localState.map.choicePath.length !== serverState.map.choicePath.length) {
    return localState.map.choicePath.length > serverState.map.choicePath.length
      ? localState as RunState
      : serverState as RunState;
  }

  return localState.map.currentNodeId === serverState.map.currentNodeId
    ? localState as RunState
    : serverState as RunState;
};

const toServerCheckpoint = (
  state: Readonly<RunState>,
  stateVersion: number,
): CheckpointRequest | null => {
  const selectedNode = generateNodeChoices(
    state.map.seed,
    state.map.currentRound,
    state.map.choicePath,
  ).find((node) => node.key === state.map.currentNodeId);

  if (selectedNode === undefined) return null;

  return {
    round: state.map.currentRound,
    choice: selectedNode.choice,
    stateVersion,
    state: {
      ...state,
      map: {
        ...state.map,
        choicePath: [...state.map.choicePath, selectedNode.choice],
      },
    },
  };
};

export class RunRemotePersistence {
  private runId: string | null = null;
  private stateVersion: number | null = null;
  private remoteIdentity: Pick<RunRemoteMetadata, "mapId" | "seed"> | null = null;
  private status: RunSyncStatus = { mode: "idle", message: "저장: 로컬" };
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly api: RunApiClient = runApiClient,
    private readonly storage: RunRemoteStorage | undefined =
      getBrowserRunRemoteStorage(),
  ) {
    const metadata = loadRunRemoteMetadata(this.storage);
    if (metadata !== null) {
      this.runId = metadata.runId;
      this.stateVersion = metadata.stateVersion;
      this.remoteIdentity = { mapId: metadata.mapId, seed: metadata.seed };
    }
  }

  get syncStatus(): RunSyncStatus {
    return this.status;
  }

  start(seed: number): Promise<Readonly<RunState> | null> {
    return this.enqueue(() => this.startImmediately(seed));
  }

  private async startImmediately(seed: number): Promise<Readonly<RunState> | null> {
    if (!await this.flushPendingCompletion()) {
      this.setStatus(
        "local_fallback",
        "저장: 로컬 전용 · 이전 서버 정산 재시도 대기 중",
      );
      return null;
    }
    this.setStatus("syncing", "저장: 서버 연결 중...");
    try {
      const created = await this.api.createRun(seed);
      this.rememberRemoteRun(
        created.runId,
        created.stateVersion,
        created.checkpoint,
      );
      this.setStatus("synced", "저장: 서버 동기화됨");
      return normalizeServerState(created.checkpoint);
    } catch (error) {
      if (error instanceof RunApiError && error.status === 409 && error.code === "active_run_exists") {
        const active = await this.fetchActiveForConflict();
        if (active !== null) return active;
      }

      this.setStatus("local_fallback", "저장: 로컬 fallback · 서버 요청 재시도 실패");
      return null;
    }
  }

  restore(localFallback: Readonly<RunState> | null): Promise<Readonly<RunState> | null> {
    return this.enqueue(() => this.restoreImmediately(localFallback));
  }

  private async restoreImmediately(
    localFallback: Readonly<RunState> | null,
  ): Promise<Readonly<RunState> | null> {
    if (!await this.flushPendingCompletion()) {
      this.setStatus(
        "local_fallback",
        "저장: 로컬 런 사용 · 이전 서버 정산 재시도 대기 중",
      );
      return localFallback;
    }
    this.setStatus("syncing", "저장: 서버 런 확인 중...");
    try {
      const response = await this.api.getActiveRun();
      if (response.run === null) {
        this.forgetRemoteRun();
        this.setStatus(
          localFallback === null ? "idle" : "local_fallback",
          localFallback === null ? "저장: 서버 활성 런 없음" : "저장: 로컬 런 사용",
        );
        return localFallback;
      }

      this.rememberRemoteRun(
        response.run.runId,
        response.run.stateVersion,
        response.run.state,
      );
      const serverState = normalizeServerState(response.run.state);
      const restored = preferLocalRunState(serverState, localFallback);
      runSession.replace(restored);
      this.setStatus(
        restored === localFallback ? "conflict_resolved" : "synced",
        restored === localFallback
          ? "저장: 최신 로컬 런 복구됨"
          : "저장: 서버 런 복구됨",
      );
      return restored;
    } catch {
      this.setStatus("local_fallback", "저장: 로컬 fallback · 서버 복구 실패");
      return localFallback;
    }
  }

  checkpoint(state: Readonly<RunState>): Promise<void> {
    return this.enqueue(() => this.saveCheckpoint(state));
  }

  private async saveCheckpoint(state: Readonly<RunState>): Promise<void> {
    if (this.runId === null || this.stateVersion === null) {
      this.setStatus("local_fallback", "저장: 로컬 전용 · 서버 런 없음");
      return;
    }
    if (!this.matchesRemoteRun(state)) {
      this.setStatus("local_fallback", "저장: 로컬 유지 · 서버 런 불일치");
      return;
    }

    const runId = this.runId;
    const request = toServerCheckpoint(state, this.stateVersion);
    if (request === null) {
      this.setStatus("local_fallback", "저장: 로컬 유지 · 체크포인트 노드 불일치");
      return;
    }

    this.setStatus("syncing", "저장: 체크포인트 동기화 중...");
    try {
      const saved = await this.api.saveCheckpoint(runId, request);
      this.rememberRemoteRun(runId, saved.stateVersion, state);
      this.setStatus("synced", "저장: 체크포인트 동기화됨");
    } catch (error) {
      if (error instanceof RunApiError && error.status === 409 && error.code === "stale_state_version") {
        const serverState = await this.fetchActiveForConflict();
        if (serverState !== null) {
          const localState = runSession.get() ?? state;
          runSession.replace(preferLocalRunState(serverState, localState));
        }
        return;
      }
      this.setStatus("local_fallback", "저장: 로컬 fallback · 체크포인트 전송 실패");
    }
  }

  complete(state: Readonly<RunState>): Promise<boolean> {
    return this.enqueue(() => this.completeImmediately(state));
  }

  private async completeImmediately(state: Readonly<RunState>): Promise<boolean> {
    if (this.runId === null) {
      this.setStatus("local_fallback", "저장: 로컬 완료 · 서버 런 없음");
      return true;
    }
    if (!this.matchesRemoteRun(state)) {
      this.forgetRemoteRun();
      this.setStatus("local_fallback", "저장: 로컬 완료 · 서버 런 불일치");
      return true;
    }
    const runId = this.runId;

    const endReason: CompleteRunRequest["endReason"] =
      state.status === "active" ? "abandoned" : state.status;
    const acquiredItemValue = calculateRunEquipmentExchangeValue(state);
    const request: CompleteRunRequest = {
      endReason,
      score: Math.max(
        0,
        Math.trunc(acquiredItemValue + state.runCurrency),
      ),
      clearedFloor: Math.max(0, state.map.currentRound),
      resultSnapshot: {
        schemaVersion: state.schemaVersion,
        mapId: state.map.mapId,
        acquiredItemValue,
      },
    };

    this.setStatus("syncing", "저장: 런 완료 기록 중...");
    try {
      await this.api.completeRun(runId, request);
      this.forgetRemoteRun();
      this.setStatus("synced", "저장: 런 완료 기록됨");
      return true;
    } catch (error) {
      if (
        error instanceof RunApiError &&
        ((error.status === 409 && error.code === "run_not_active") ||
          (error.status === 404 && error.code === "run_not_found"))
      ) {
        this.forgetRemoteRun();
        this.setStatus("synced", "저장: 서버 런 이미 종료됨");
        return true;
      }
      if (
        isRetryableCompletionError(error) &&
        savePendingRunCompletion(
          { runId, request },
          this.storage,
        )
      ) {
        this.forgetRemoteRun();
        this.setStatus(
          "local_fallback",
          "저장: 로컬 완료 · 서버 기록 재시도 대기 중",
        );
        return true;
      }
      this.setStatus("local_fallback", "저장: 로컬 완료 · 서버 기록 실패");
      return false;
    }
  }

  private async fetchActiveForConflict(): Promise<Readonly<RunState> | null> {
    try {
      const response = await this.api.getActiveRun();
      if (response.run === null) {
        this.forgetRemoteRun();
        this.setStatus("local_fallback", "저장: 충돌 복구 실패 · 활성 서버 런 없음");
        return null;
      }

      this.rememberRemoteRun(
        response.run.runId,
        response.run.stateVersion,
        response.run.state,
      );
      const restored = normalizeServerState(response.run.state);
      this.setStatus("conflict_resolved", "저장: 서버 상태로 충돌 복구됨");
      return restored;
    } catch {
      this.setStatus("local_fallback", "저장: 로컬 fallback · 충돌 복구 실패");
      return null;
    }
  }

  private setStatus(mode: RunSyncMode, message: string): void {
    this.status = { mode, message };
  }

  private rememberRemoteRun(
    runId: string,
    stateVersion: number,
    state: Readonly<RunState>,
  ): void {
    this.runId = runId;
    this.stateVersion = stateVersion;
    this.remoteIdentity = {
      mapId: state.map.mapId,
      seed: state.map.seed,
    };
    saveRunRemoteMetadata({
      runId,
      stateVersion,
      ...this.remoteIdentity,
    }, this.storage);
  }

  private forgetRemoteRun(): void {
    this.runId = null;
    this.stateVersion = null;
    this.remoteIdentity = null;
    clearRunRemoteMetadata(this.storage);
  }

  private matchesRemoteRun(state: Readonly<RunState>): boolean {
    return this.remoteIdentity !== null &&
      state.map.mapId === this.remoteIdentity.mapId &&
      state.map.seed === this.remoteIdentity.seed;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.operationQueue.then(operation);
    this.operationQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  private async flushPendingCompletion(): Promise<boolean> {
    const pending = loadPendingRunCompletion(this.storage);
    if (pending === null) return true;

    try {
      await this.api.completeRun(pending.runId, pending.request);
    } catch (error) {
      const alreadyFinished =
        error instanceof RunApiError &&
        ((error.status === 409 && error.code === "run_not_active") ||
          (error.status === 404 && error.code === "run_not_found"));
      if (!alreadyFinished && isRetryableCompletionError(error)) return false;
    }

    clearPendingRunCompletion(this.storage);
    if (loadPendingRunCompletion(this.storage) !== null) return false;
    if (this.runId === pending.runId) this.forgetRemoteRun();
    return true;
  }
}

export const runRemotePersistence = new RunRemotePersistence();
