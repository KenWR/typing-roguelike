import type { D1Database } from "@cloudflare/workers-types";
import { D1RunRepository } from "../repositories/d1-run-repository.ts";
import type { RunRepository } from "../repositories/run-repository.ts";

export const D1_BINDING_NAME = "DB" as const;

export interface D1Environment {
  DB: D1Database;
}

export const createD1RunRepository = (database: D1Database): RunRepository =>
  new D1RunRepository(database);
