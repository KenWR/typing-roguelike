import {
  generateNodeChoices,
  type CheckpointRequest,
  type CompleteRunRequest,
  type RunState,
} from "@typing-roguelike/shared";
import { RunApiError, runApiClient, type RunApiClient } from "../api/run-api-client";
import { normalizeRestoredRunState } from "./run-persistence";
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

  const currentStatus = normalized.map.nodeStatuses[normalized.map.currentNodeId];
  if (
    currentStatus === "in_progress" &&
    normalized.map.choicePath.length === normalized.map.currentRound
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
  private status: RunSyncStatus = { mode: "idle", message: "저장: 로컬" };

  constructor(private readonly api: RunApiClient = runApiClient) {}

  get syncStatus(): RunSyncStatus {
    return this.status;
  }

  async start(seed: number): Promise<Readonly<RunState> | null> {
    this.setStatus("syncing", "저장: 서버 연결 중...");
    try {
      const created = await this.api.createRun(seed);
      this.runId = created.runId;
      this.stateVersion = created.stateVersion;
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

  async restore(localFallback: Readonly<RunState> | null): Promise<Readonly<RunState> | null> {
    this.setStatus("syncing", "저장: 서버 런 확인 중...");
    try {
      const response = await this.api.getActiveRun();
      if (response.run === null) {
        this.runId = null;
        this.stateVersion = null;
        this.setStatus(
          localFallback === null ? "idle" : "local_fallback",
          localFallback === null ? "저장: 서버 활성 런 없음" : "저장: 로컬 런 사용",
        );
        return localFallback;
      }

      this.runId = response.run.runId;
      this.stateVersion = response.run.stateVersion;
      const restored = normalizeServerState(response.run.state);
      runSession.replace(restored);
      this.setStatus("synced", "저장: 서버 런 복구됨");
      return restored;
    } catch {
      this.setStatus("local_fallback", "저장: 로컬 fallback · 서버 복구 실패");
      return localFallback;
    }
  }

  async checkpoint(state: Readonly<RunState>): Promise<void> {
    if (this.runId === null || this.stateVersion === null) {
      this.setStatus("local_fallback", "저장: 로컬 전용 · 서버 런 없음");
      return;
    }

    const request = toServerCheckpoint(state, this.stateVersion);
    if (request === null) {
      this.setStatus("local_fallback", "저장: 로컬 유지 · 체크포인트 노드 불일치");
      return;
    }

    this.setStatus("syncing", "저장: 체크포인트 동기화 중...");
    try {
      const saved = await this.api.saveCheckpoint(this.runId, request);
      this.stateVersion = saved.stateVersion;
      this.setStatus("synced", "저장: 체크포인트 동기화됨");
    } catch (error) {
      if (error instanceof RunApiError && error.status === 409 && error.code === "stale_state_version") {
        const restored = await this.fetchActiveForConflict();
        if (restored !== null) runSession.replace(restored);
        return;
      }
      this.setStatus("local_fallback", "저장: 로컬 fallback · 체크포인트 전송 실패");
    }
  }

  async complete(state: Readonly<RunState>): Promise<void> {
    if (this.runId === null) {
      this.setStatus("local_fallback", "저장: 로컬 완료 · 서버 런 없음");
      return;
    }

    const endReason: CompleteRunRequest["endReason"] =
      state.status === "active" ? "abandoned" : state.status;
    const request: CompleteRunRequest = {
      endReason,
      score: Math.max(0, Math.trunc(state.acquiredItemValue + state.runCurrency)),
      clearedFloor: Math.max(0, state.map.currentRound),
      resultSnapshot: {
        schemaVersion: state.schemaVersion,
        mapId: state.map.mapId,
        acquiredItemValue: state.acquiredItemValue,
      },
    };

    this.setStatus("syncing", "저장: 런 완료 기록 중...");
    try {
      await this.api.completeRun(this.runId, request);
      this.runId = null;
      this.stateVersion = null;
      this.setStatus("synced", "저장: 런 완료 기록됨");
    } catch {
      this.setStatus("local_fallback", "저장: 로컬 완료 · 서버 기록 실패");
    }
  }

  private async fetchActiveForConflict(): Promise<Readonly<RunState> | null> {
    try {
      const response = await this.api.getActiveRun();
      if (response.run === null) {
        this.runId = null;
        this.stateVersion = null;
        this.setStatus("local_fallback", "저장: 충돌 복구 실패 · 활성 서버 런 없음");
        return null;
      }

      this.runId = response.run.runId;
      this.stateVersion = response.run.stateVersion;
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
}

export const runRemotePersistence = new RunRemotePersistence();
