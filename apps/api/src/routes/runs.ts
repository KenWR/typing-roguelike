import { Router } from "express";
import type {
  CheckpointRequest,
  CompleteRunRequest,
  CreateRunRequest,
} from "@typing-roguelike/shared";
import { RunServiceError, type RunService } from "../services/run-service.ts";

const serviceErrorCode = (error: unknown): RunServiceError["code"] | null =>
  error instanceof RunServiceError ? error.code : null;

export const createRunsRouter = (service: RunService): Router => {
  const router: Router = Router();

  router.post("/", async (request, response) => {
    try {
      const body = request.body as CreateRunRequest | undefined;
      response.status(201).json(await service.createRun(response.locals.anonymousPlayerId, body?.seed));
    } catch (error) {
      if (serviceErrorCode(error) === "ACTIVE_RUN_EXISTS") {
        response.status(409).json({ error: "active_run_exists" });
        return;
      }
      response.status(500).json({ error: "internal_error" });
    }
  });

  router.get("/active", async (_request, response) => {
    response.json({ run: await service.getActiveRun(response.locals.anonymousPlayerId) });
  });

  router.put("/:runId/checkpoint", async (request, response) => {
    try {
      response.json(await service.saveCheckpoint(
        response.locals.anonymousPlayerId,
        request.params.runId,
        request.body as CheckpointRequest,
      ));
    } catch (error) {
      const code = serviceErrorCode(error);
      const status = code === "STALE_STATE_VERSION"
        ? 409
        : code === "NODE_STATE_MISMATCH" || code === "INVALID_REQUEST"
          ? 400
          : code === "RUN_NOT_ACTIVE"
            ? 409
            : code === "RUN_NOT_FOUND"
              ? 404
              : 500;
      response.status(status).json({ error: code?.toLowerCase() ?? "internal_error" });
    }
  });

  router.post("/:runId/complete", async (request, response) => {
    try {
      response.json(await service.completeRun(
        response.locals.anonymousPlayerId,
        request.params.runId,
        request.body as CompleteRunRequest,
      ));
    } catch (error) {
      const code = serviceErrorCode(error);
      const status = code === "RUN_NOT_ACTIVE"
        ? 409
        : code === "RUN_NOT_FOUND"
          ? 404
          : code === "INVALID_REQUEST"
            ? 400
            : 500;
      response.status(status).json({ error: code?.toLowerCase() ?? "internal_error" });
    }
  });

  return router;
};
