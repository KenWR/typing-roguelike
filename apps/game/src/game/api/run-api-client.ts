import type {
  CheckpointRequest,
  CompleteRunRequest,
  CreateRunResponse,
  GeneratedMapNode,
  RunState,
} from "@typing-roguelike/shared";

export type ActiveRunSnapshot = Readonly<{
  runId: string;
  nodeId: string;
  floor: number;
  state: RunState;
  stateVersion: number;
  savedAt: string;
}>;

export type ActiveRunResponse = Readonly<{ run: ActiveRunSnapshot | null }>;

export type CheckpointResponse = Readonly<{
  stateVersion: number;
  savedAt: string;
  nodeChoices: GeneratedMapNode[];
}>;

export type CompleteRunResponse = Readonly<{
  runId: string;
  finalizedAt: string;
}>;

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const importMetaEnv = (import.meta as ImportMeta & {
  env?: Readonly<Record<string, string | undefined>>;
}).env;

export const DEFAULT_GAME_API_BASE_URL =
  importMetaEnv?.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export class RunApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "RunApiError";
  }
}

const readErrorCode = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : `http_${response.status}`;
  } catch {
    return `http_${response.status}`;
  }
};

export class RunApiClient {
  constructor(
    private readonly baseUrl = DEFAULT_GAME_API_BASE_URL,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly requestTimeoutMs = 2_500,
    private readonly maxAttempts = 2,
  ) {}

  createRun(seed: number): Promise<CreateRunResponse> {
    return this.request<CreateRunResponse>("/runs", {
      method: "POST",
      body: JSON.stringify({ seed }),
    });
  }

  getActiveRun(): Promise<ActiveRunResponse> {
    return this.request<ActiveRunResponse>("/runs/active", { method: "GET" });
  }

  saveCheckpoint(runId: string, input: CheckpointRequest): Promise<CheckpointResponse> {
    return this.request<CheckpointResponse>(`/runs/${encodeURIComponent(runId)}/checkpoint`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  completeRun(runId: string, input: CompleteRunRequest): Promise<CompleteRunResponse> {
    return this.request<CompleteRunResponse>(`/runs/${encodeURIComponent(runId)}/complete`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      const headers = new Headers(init.headers);
      headers.set("Accept", "application/json");
      if (init.body !== undefined) headers.set("Content-Type", "application/json");

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          credentials: "include",
          signal: controller.signal,
          headers,
        });

        if (!response.ok) {
          const apiError = new RunApiError(response.status, await readErrorCode(response));
          if (response.status < 500 || attempt === this.maxAttempts) throw apiError;
          lastError = apiError;
          continue;
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error;
        if (error instanceof RunApiError || attempt === this.maxAttempts) throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("run_api_request_failed");
  }
}

export const runApiClient = new RunApiClient();
