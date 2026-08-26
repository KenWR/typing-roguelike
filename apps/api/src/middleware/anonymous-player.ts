import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { RunRepository } from "../repositories/run-repository.ts";

export const createAnonymousPlayerMiddleware = (repository: RunRepository): RequestHandler =>
  async (request, response, next) => {
    try {
      const cookie = request.headers.cookie
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("anonymous_player_id="));
      const existingId = cookie?.slice("anonymous_player_id=".length);
      const playerId = existingId && /^[0-9a-f-]{36}$/i.test(existingId) ? existingId : randomUUID();
      const timestamp = new Date().toISOString();

      await repository.ensureAnonymousPlayer(playerId, timestamp);

      if (!existingId || existingId !== playerId) {
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        response.setHeader(
          "Set-Cookie",
          `anonymous_player_id=${playerId}; Max-Age=2592000; HttpOnly${secure}; SameSite=Lax; Path=/`,
        );
      }

      response.locals.anonymousPlayerId = playerId;
      next();
    } catch (error) {
      next(error);
    }
  };
