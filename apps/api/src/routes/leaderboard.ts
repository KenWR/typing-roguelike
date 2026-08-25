import { Router } from "express";
import { getLeaderboard } from "../services/run-service.ts";

export const leaderboardRouter: Router = Router();

leaderboardRouter.get("/", (request, response) => {
  const requestedLimit = Number(request.query.limit ?? 20);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
  response.json({ entries: getLeaderboard(limit) });
});