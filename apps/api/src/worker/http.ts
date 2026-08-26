import type {
  CheckpointRequest,
  CompleteRunRequest,
  CreateRunRequest,
} from "@typing-roguelike/shared";
import { createD1RunRepository } from "../config/database.ts";
import { openApiDocument } from "../config/openapi.ts";
import type { RunRepository } from "../repositories/run-repository.ts";
import { RunServiceError, createRunService, type RunService } from "../services/run-service.ts";
import type { D1Environment } from "../config/database.ts";

export interface WorkerEnv extends D1Environment {
  API_ORIGIN?: string;
  COOKIE_SECURE?: string;
  CORS_ORIGIN?: string;
}

const MAX_JSON_BODY_BYTES = 1_048_576;

class WorkerRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = "WorkerRequestError";
  }
}

const jsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8" },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const newId = (): string => globalThis.crypto.randomUUID();

const normalizeOrigin = (value: string): string | undefined => {
  try {
    const origin = new URL(value).origin;
    return origin === "null" ? undefined : origin;
  } catch {
    return undefined;
  }
};

const allowedOrigins = (env: WorkerEnv): Set<string> => {
  const configured = env.CORS_ORIGIN?.split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => value !== undefined);

  return new Set(configured && configured.length > 0 ? configured : ["http://localhost:5173"]);
};

const isAllowedOrigin = (origin: string | null, env: WorkerEnv): boolean =>
  origin === null || allowedOrigins(env).has(origin);

const addCorsHeaders = (response: Response, request: Request, env: WorkerEnv): Response => {
  const origin = request.headers.get("Origin");
  if (origin === null || !isAllowedOrigin(origin, env)) return response;

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Headers", "Accept, Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  response.headers.set("Vary", "Origin");
  return response;
};

const resolveApiOrigin = (request: Request, env: WorkerEnv): string => {
  const configured = env.API_ORIGIN?.trim();
  if (configured !== undefined && configured !== "") {
    const normalized = normalizeOrigin(configured);
    if (normalized !== undefined) return normalized;
  }

  return new URL(request.url).origin;
};

const openApiForRequest = (request: Request, env: WorkerEnv) => ({
  ...openApiDocument,
  servers: [{ url: resolveApiOrigin(request, env), description: "현재 API origin" }],
});

const readJsonBody = async (request: Request): Promise<unknown> => {
  const contentLength = request.headers.get("Content-Length");
  const declaredLength = contentLength === null ? undefined : Number(contentLength);
  if (declaredLength !== undefined && Number.isSafeInteger(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new WorkerRequestError(413, "payload_too_large");
  }

  if (request.body === null) return undefined;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_JSON_BODY_BYTES) {
        throw new WorkerRequestError(413, "payload_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const rawBody = new TextDecoder().decode(bodyBytes);
  if (rawBody.trim() === "") return undefined;

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new WorkerRequestError(400, "invalid_json");
  }
};

const readCreateSeed = (body: unknown): CreateRunRequest["seed"] => {
  if (body === undefined) return undefined;
  if (!isRecord(body)) throw new WorkerRequestError(400, "invalid_request");

  const seed = body.seed;
  if (seed !== undefined && (typeof seed !== "number" || !Number.isSafeInteger(seed) || seed < 0)) {
    throw new WorkerRequestError(400, "invalid_request");
  }

  return seed as CreateRunRequest["seed"];
};

const readRunId = (encodedRunId: string): string => {
  try {
    const runId = decodeURIComponent(encodedRunId);
    if (runId === "") throw new Error("empty_run_id");
    return runId;
  } catch {
    throw new WorkerRequestError(400, "invalid_request");
  }
};

const readAnonymousPlayerId = (request: Request): string | undefined => {
  const cookie = request.headers.get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("anonymous_player_id="));
  const existingId = cookie?.slice("anonymous_player_id=".length);
  return existingId && /^[0-9a-f-]{36}$/i.test(existingId) ? existingId : undefined;
};

const cookieHeader = (playerId: string, request: Request, env: WorkerEnv): string => {
  const requestUrl = new URL(request.url);
  const configuredSecure = env.COOKIE_SECURE?.trim().toLowerCase();
  const secure = requestUrl.protocol === "https:" && configuredSecure !== "false";
  const sameSite = secure ? "None" : "Lax";
  return `anonymous_player_id=${playerId}; Max-Age=2592000; HttpOnly${secure ? "; Secure" : ""}; SameSite=${sameSite}; Path=/`;
};

const ensureAnonymousPlayer = async (
  repository: RunRepository,
  request: Request,
  env: WorkerEnv,
): Promise<{ playerId: string; setCookie?: string }> => {
  const existingId = readAnonymousPlayerId(request);
  const playerId = existingId ?? newId();
  await repository.ensureAnonymousPlayer(playerId, new Date().toISOString());

  return existingId === undefined
    ? { playerId, setCookie: cookieHeader(playerId, request, env) }
    : { playerId };
};

const serviceErrorResponse = (error: unknown): Response => {
  if (error instanceof WorkerRequestError) return jsonResponse({ error: error.code }, error.status);

  if (error instanceof RunServiceError) {
    const status = error.code === "RUN_NOT_FOUND"
      ? 404
      : error.code === "NODE_STATE_MISMATCH" || error.code === "INVALID_REQUEST"
        ? 400
        : error.code === "ACTIVE_RUN_EXISTS" || error.code === "RUN_NOT_ACTIVE" || error.code === "STALE_STATE_VERSION"
          ? 409
          : 500;
    return jsonResponse({ error: error.code.toLowerCase() }, status);
  }

  return jsonResponse({ error: "internal_error" }, 500);
};

const normalizedPath = (request: Request): string => {
  const pathname = new URL(request.url).pathname;
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
};

const hasKnownRoute = (method: string, path: string): boolean => {
  if (method === "POST" && path === "/runs") return true;
  if (method === "GET" && (path === "/runs/active" || path === "/leaderboard" || path === "/health" || path === "/openapi.json")) return true;
  if (method === "PUT" && /^\/runs\/[^/]+\/checkpoint$/.test(path)) return true;
  if (method === "POST" && /^\/runs\/[^/]+\/complete$/.test(path)) return true;
  return false;
};

const dispatchRequest = async (
  request: Request,
  path: string,
  service: RunService,
  playerId: string,
): Promise<Response> => {
  if (request.method === "POST" && path === "/runs") {
    const seed = readCreateSeed(await readJsonBody(request));
    return jsonResponse(await service.createRun(playerId, seed), 201);
  }

  if (request.method === "GET" && path === "/runs/active") {
    return jsonResponse({ run: await service.getActiveRun(playerId) });
  }

  const checkpointMatch = path.match(/^\/runs\/([^/]+)\/checkpoint$/);
  if (request.method === "PUT" && checkpointMatch !== null) {
    return jsonResponse(await service.saveCheckpoint(
      playerId,
      readRunId(checkpointMatch[1]!),
      await readJsonBody(request) as CheckpointRequest,
    ));
  }

  const completeMatch = path.match(/^\/runs\/([^/]+)\/complete$/);
  if (request.method === "POST" && completeMatch !== null) {
    return jsonResponse(await service.completeRun(
      playerId,
      readRunId(completeMatch[1]!),
      await readJsonBody(request) as CompleteRunRequest,
    ));
  }

  if (request.method === "GET" && path === "/leaderboard") {
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 20);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
    return jsonResponse({ entries: await service.getLeaderboard(limit) });
  }

  return jsonResponse({ error: "not_found" }, 404);
};

export const handleWorkerRequest = async (request: Request, env: WorkerEnv): Promise<Response> => {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, env)) {
    return jsonResponse({ error: "cors_origin_not_allowed" }, 403);
  }

  if (request.method === "OPTIONS") {
    return addCorsHeaders(new Response(null, { status: 204 }), request, env);
  }

  const path = normalizedPath(request);
  if (request.method === "GET" && path === "/health") {
    return addCorsHeaders(jsonResponse({ status: "ok" }), request, env);
  }

  if (request.method === "GET" && path === "/openapi.json") {
    return addCorsHeaders(jsonResponse(openApiForRequest(request, env)), request, env);
  }

  if (!hasKnownRoute(request.method, path)) {
    return addCorsHeaders(jsonResponse({ error: "not_found" }, 404), request, env);
  }

  try {
    const repository = createD1RunRepository(env.DB);
    const service = createRunService(repository);
    const identity = await ensureAnonymousPlayer(repository, request, env);
    let response: Response;

    try {
      response = await dispatchRequest(request, path, service, identity.playerId);
    } catch (error) {
      response = serviceErrorResponse(error);
    }

    if (identity.setCookie !== undefined) response.headers.append("Set-Cookie", identity.setCookie);
    return addCorsHeaders(response, request, env);
  } catch (error) {
    return addCorsHeaders(serviceErrorResponse(error), request, env);
  }
};
