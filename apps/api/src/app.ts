import express, { type ErrorRequestHandler, type Express } from "express";
import swaggerUi from "swagger-ui-express";
import type { RunRepository } from "./repositories/run-repository.ts";
import { openApiDocument } from "./config/openapi.ts";
import { createAnonymousPlayerMiddleware } from "./middleware/anonymous-player.ts";
import { createLeaderboardRouter } from "./routes/leaderboard.ts";
import { createRunsRouter } from "./routes/runs.ts";
import { createRunService } from "./services/run-service.ts";

export interface CreateAppOptions {
  repository: RunRepository;
}

export const createApp = ({ repository }: CreateAppOptions): Express => {
  const app = express();
  const service = createRunService(repository);

  app.disable("x-powered-by");
  const allowedOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json());
  app.use(createAnonymousPlayerMiddleware(repository));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.get("/openapi.json", (_request, response) => {
    response.json(openApiDocument);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use("/leaderboard", createLeaderboardRouter(service));
  app.use("/runs", createRunsRouter(service));

  const internalErrorHandler: ErrorRequestHandler = (_error, _request, response, _next) => {
    if (response.headersSent) return;
    response.status(500).json({ error: "internal_error" });
  };
  app.use(internalErrorHandler);

  return app;
};
