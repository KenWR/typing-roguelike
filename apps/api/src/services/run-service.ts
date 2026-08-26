import { createHash, randomUUID } from "node:crypto";
import {
  createInitialRunState,
  generateNodeChoices,
  MAP_ROUND_COUNT,
  START_NODE_KEY,
  type CheckpointRequest,
  type CompleteRunRequest,
  type CreateRunResponse,
  type RunState,
} from "@typing-roguelike/shared";
import type {
  ActiveRunRecord,
  LeaderboardRecord,
  RunRepository,
} from "../repositories/run-repository.ts";

export type RunServiceErrorCode =
  | "ACTIVE_RUN_EXISTS"
  | "RUN_NOT_FOUND"
  | "RUN_NOT_ACTIVE"
  | "STALE_STATE_VERSION"
  | "NODE_STATE_MISMATCH"
  | "INVALID_REQUEST";

export class RunServiceError extends Error {
  public constructor(public readonly code: RunServiceErrorCode) {
    super(code);
    this.name = "RunServiceError";
  }
}

export interface RunService {
  createRun(playerId: string, requestedSeed?: number): Promise<CreateRunResponse>;
  getActiveRun(playerId: string): Promise<ActiveRunRecord | null>;
  saveCheckpoint(
    playerId: string,
    runId: string,
    request: CheckpointRequest,
  ): Promise<{ stateVersion: number; savedAt: string; nodeChoices: ReturnType<typeof generateNodeChoices> }>;
  completeRun(
    playerId: string,
    runId: string,
    input: CompleteRunRequest,
  ): Promise<{ runId: string; finalizedAt: string }>;
  getLeaderboard(limit: number): Promise<LeaderboardRecord[]>;
}

const now = (): string => new Date().toISOString();
const hashState = (state: RunState): string =>
  createHash("sha256").update(JSON.stringify(state)).digest("hex");

const randomMapSeed = (): number => Math.floor(Math.random() * 2_147_483_647);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidCompleteRequest = (input: CompleteRunRequest | undefined): boolean => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;

  const validEndReason = ["dead", "cleared", "abandoned"].includes(input.endReason);
  const validScore = Number.isSafeInteger(input.score) && input.score >= 0;
  const validFloor = Number.isSafeInteger(input.clearedFloor) && input.clearedFloor >= 0;
  const validAccuracy = input.accuracy === undefined ||
    (Number.isFinite(input.accuracy) && input.accuracy >= 0 && input.accuracy <= 100);
  const validSnapshot = input.resultSnapshot === undefined || isRecord(input.resultSnapshot);

  if (!validSnapshot) return false;
  try {
    JSON.stringify(input.resultSnapshot ?? {});
  } catch {
    return false;
  }

  return validEndReason && validScore && validFloor && validAccuracy;
};

const assertCheckpointRequest = (request: CheckpointRequest): void => {
  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    !Number.isSafeInteger(request.round) ||
    request.round < 1 ||
    ![1, 2, 3].includes(request.choice) ||
    !Number.isSafeInteger(request.stateVersion) ||
    request.stateVersion < 1 ||
    !isRecord(request.state) ||
    !isRecord(request.state.map) ||
    typeof request.state.map.mapId !== "string" ||
    !Number.isSafeInteger(request.state.map.seed) ||
    !Array.isArray(request.state.map.choicePath)
  ) {
    throw new RunServiceError("INVALID_REQUEST");
  }
};

export const createRunService = (repository: RunRepository): RunService => ({
  async createRun(playerId, requestedSeed) {
    const runId = randomUUID();
    const timestamp = now();
    const mapSeed = Number.isSafeInteger(requestedSeed) && requestedSeed !== undefined && requestedSeed >= 0
      ? requestedSeed
      : randomMapSeed();
    const state = createInitialRunState({ seed: mapSeed });
    const result = await repository.createRun({
      runId,
      checkpointId: randomUUID(),
      playerId,
      state,
      stateHash: hashState(state),
      timestamp,
    });

    if (result === "active_run_exists") {
      throw new RunServiceError("ACTIVE_RUN_EXISTS");
    }

    return {
      runId,
      stateVersion: 1,
      checkpoint: state,
      nodeChoices: generateNodeChoices(mapSeed, 1, []),
    };
  },

  getActiveRun(playerId) {
    return repository.getActiveRun(playerId);
  },

  async saveCheckpoint(playerId, runId, request) {
    assertCheckpointRequest(request);
    const storedRun = await repository.getOwnedRun(playerId, runId);

    if (!storedRun) throw new RunServiceError("RUN_NOT_FOUND");
    if (storedRun.status !== "active") throw new RunServiceError("RUN_NOT_ACTIVE");
    if (storedRun.stateVersion !== request.stateVersion) {
      throw new RunServiceError("STALE_STATE_VERSION");
    }

    const storedState = storedRun.state;
    const previousPath = storedState.map.choicePath;
    const expectedRound = previousPath.length + 1;
    if (request.round !== expectedRound || request.round > MAP_ROUND_COUNT) {
      throw new RunServiceError("NODE_STATE_MISMATCH");
    }

    const selectedNode = generateNodeChoices(
      storedState.map.seed,
      request.round,
      previousPath,
    ).find((node) => node.choice === request.choice);
    const previousNode = request.round <= 1
      ? undefined
      : generateNodeChoices(
        storedState.map.seed,
        request.round - 1,
        previousPath.slice(0, -1),
      ).find((node) => node.key === storedRun.nodeId);
    const legacyParentKey = previousPath.length === 0
      ? START_NODE_KEY
      : `${request.round - 1}-${previousPath.at(-1)}`;
    const isConnected = request.round === 1
      ? storedRun.nodeId === START_NODE_KEY
      : previousNode?.nextNodeKeys.includes(selectedNode?.key ?? "") === true;

    if (
      selectedNode === undefined ||
      (!isConnected && selectedNode.parentKey !== storedRun.nodeId && storedRun.nodeId !== legacyParentKey)
    ) {
      throw new RunServiceError("NODE_STATE_MISMATCH");
    }

    const nextPath = [...previousPath, request.choice];
    if (
      request.state.map.mapId !== storedState.map.mapId ||
      request.state.map.seed !== storedState.map.seed ||
      request.state.map.currentRound !== request.round ||
      request.state.map.choicePath.length !== nextPath.length ||
      request.state.map.choicePath.some((value, index) => value !== nextPath[index])
    ) {
      throw new RunServiceError("NODE_STATE_MISMATCH");
    }

    const checkpointState: RunState = {
      ...request.state,
      map: {
        ...request.state.map,
        currentNodeId: selectedNode.key,
        choicePath: nextPath,
      },
    };
    const savedAt = now();
    const result = await repository.saveCheckpoint({
      checkpointId: randomUUID(),
      playerId,
      runId,
      expectedVersion: request.stateVersion,
      nodeId: selectedNode.key,
      floor: request.round,
      state: checkpointState,
      stateHash: hashState(checkpointState),
      timestamp: savedAt,
    });

    if (result === "run_not_found") throw new RunServiceError("RUN_NOT_FOUND");
    if (result === "run_not_active") throw new RunServiceError("RUN_NOT_ACTIVE");
    if (result === "stale_state_version") throw new RunServiceError("STALE_STATE_VERSION");

    return {
      stateVersion: request.stateVersion + 1,
      savedAt,
      nodeChoices: request.round < MAP_ROUND_COUNT
        ? generateNodeChoices(checkpointState.map.seed, request.round + 1, checkpointState.map.choicePath)
        : [],
    };
  },

  async completeRun(playerId, runId, input) {
    if (!isValidCompleteRequest(input)) {
      throw new RunServiceError("INVALID_REQUEST");
    }

    const finalizedAt = now();
    const result = await repository.completeRun({ playerId, runId, input, timestamp: finalizedAt });
    if (result === "run_not_found") throw new RunServiceError("RUN_NOT_FOUND");
    if (result === "run_not_active") throw new RunServiceError("RUN_NOT_ACTIVE");

    return { runId, finalizedAt };
  },

  getLeaderboard(limit) {
    return repository.getLeaderboard(limit);
  },
});
