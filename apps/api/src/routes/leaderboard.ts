import { Router } from "express";
import type { RunService } from "../services/run-service.ts";

export const createLeaderboardRouter = (service: RunService): Router => {
  const router: Router = Router();

  router.get("/", async (request, response) => {
    const requestedLimit = Number(request.query.limit ?? 20);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
    response.json({ entries: await service.getLeaderboard(limit) });
  });

  return router;
};
