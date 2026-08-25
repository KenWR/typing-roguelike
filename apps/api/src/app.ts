import express, { type Express } from "express";
import { anonymousPlayerMiddleware } from "./middleware/anonymous-player.ts";
import { runsRouter } from "./routes/runs.ts";

export const createApp = (): Express => {
  const app = express();

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
  app.use(anonymousPlayerMiddleware);

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use("/runs", runsRouter);

  return app;
};
