import type { D1Database } from "@cloudflare/workers-types";
import { createD1RunRepository } from "./config/database.ts";
import { createApp } from "./app.ts";

type D1Global = typeof globalThis & { DB?: D1Database };
const d1Database = (globalThis as D1Global).DB;

if (!d1Database) {
  throw new Error(
    "Cloudflare D1 binding DB is required. The Express adapter is created with createApp({ repository });",
  );
}

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

createApp({ repository: createD1RunRepository(d1Database) }).listen(port, host, () => {
  console.log(`API server listening on http://${host}:${port}`);
});
