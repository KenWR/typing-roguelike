import { Router } from "express";
import type {
  CheckpointRequest,
  CompleteRunRequest,
  CreateRunRequest,
} from "@typing-roguelike/shared";
import { completeRun, createRun, getActiveRun, saveCheckpoint } from "../services/run-service.ts";

export const runsRouter: Router = Router();

runsRouter.post("/", (request, response) => {
  try {
    const body = request.body as CreateRunRequest | undefined;
    response.status(201).json(createRun(response.locals.anonymousPlayerId, body?.seed));
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_RUN_EXISTS") {
      response.status(409).json({ error: "active_run_exists" });
      return;
    }
    response.status(500).json({ error: "internal_error" });
  }
});

runsRouter.get("/active", (_request, response) => {
  response.json({ run: getActiveRun(response.locals.anonymousPlayerId) });
});

runsRouter.put("/:runId/checkpoint", (request, response) => {
  try {
    const body = request.body as CheckpointRequest;
    response.json(saveCheckpoint(
      response.locals.anonymousPlayerId, request.params.runId, body.round, body.choice,
      body.stateVersion, body.state,
    ));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "STALE_STATE_VERSION" ? 409 : code === "NODE_STATE_MISMATCH" ? 400 : 404;
    response.status(status).json({ error: code.toLowerCase() || "run_not_found" });
  }
});

runsRouter.post("/:runId/complete", (request, response) => {
  try {
    response.json(completeRun(
      response.locals.anonymousPlayerId, request.params.runId, request.body as CompleteRunRequest,
    ));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    response.status(code === "RUN_NOT_ACTIVE" ? 409 : 400)
      .json({ error: code.toLowerCase() || "invalid_request" });
  }
});
