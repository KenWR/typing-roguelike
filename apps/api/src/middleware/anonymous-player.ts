import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { database } from "../config/database.ts";

export const anonymousPlayerMiddleware: RequestHandler = (request, response, next) => {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("anonymous_player_id="));
  const existingId = cookie?.slice("anonymous_player_id=".length);
  const playerId = existingId && /^[0-9a-f-]{36}$/i.test(existingId) ? existingId : randomUUID();
  const now = new Date().toISOString();

  database.prepare(`
    INSERT INTO anonymous_players (id, created_at, last_seen_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at
  `).run(playerId, now, now);

  if (!existingId || existingId !== playerId) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.setHeader(
      "Set-Cookie",
      `anonymous_player_id=${playerId}; Max-Age=2592000; HttpOnly${secure}; SameSite=Lax; Path=/`,
    );
  }

  response.locals.anonymousPlayerId = playerId;
  next();
};