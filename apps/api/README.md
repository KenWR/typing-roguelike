# Typing Roguelike API Worker

`apps/api/src/worker.ts` is the production entrypoint. It uses the Fetch API,
injects the Cloudflare D1 `DB` binding into `D1RunRepository`, and creates the
existing `RunService` contract for each request. `src/server.ts`, Express, and
Swagger UI remain available for local adapter tests and are excluded from the
Worker import graph.

## Local Worker and D1

Requirements: Bun 1.3+, Wrangler 4.126.0, and a Cloudflare account only for a
remote deployment. Local D1 uses Wrangler's SQLite-backed state and does not
modify a remote database.

Run these commands from `apps/api`:

```bash
bun install
bun run db:migrate:local
bun run dev:worker
```

The Worker listens on `http://localhost:8787`. The default local CORS origin is
`http://localhost:5173`; production and other environments should pass an
explicit comma-separated `CORS_ORIGIN`. `API_ORIGIN` controls the `servers` URL
returned by `/openapi.json` and defaults to the request origin.

The direct Worker/D1 lifecycle test uses the same repository contract with an
in-memory D1-compatible test database:

```bash
bun run test:worker
```

For an HTTP smoke check against Wrangler local mode, keep `bun run dev:worker`
running in one terminal and use another terminal:

```bash
curl -i http://localhost:8787/health
curl -i -c /tmp/typing-roguelike-api.cookies \
  -H 'Origin: http://localhost:5173' \
  -H 'Content-Type: application/json' \
  -d '{"seed":42}' \
  http://localhost:8787/runs
curl -i -b /tmp/typing-roguelike-api.cookies \
  -H 'Origin: http://localhost:5173' \
  http://localhost:8787/runs/active
```

`bun run build:worker` runs Wrangler's local bundle and dry-run checks. It does
not upload a Worker or change a remote D1 database.

## Production prerequisites and deployment

Production deployment requires Cloudflare authentication, a provisioned D1
database, and the real database ID in the deployment configuration. The
checked-in zero UUID remains a local/dry-run placeholder; this task does not
create a production database or commit a production ID. Configure the real
binding through the approved deployment configuration before deploying.

First run the dry-run with environment-specific, non-secret variables:

```bash
bunx wrangler@4.126.0 deploy --dry-run \
  --var CORS_ORIGIN:https://game.example.com \
  --var API_ORIGIN:https://api.example.com \
  --var COOKIE_SECURE:true
```

After the binding and deployment review are complete, the separate upload
command is:

```bash
bunx wrangler@4.126.0 deploy \
  --var CORS_ORIGIN:https://game.example.com \
  --var API_ORIGIN:https://api.example.com \
  --var COOKIE_SECURE:true
```

No production deploy is performed by the issue #259 implementation task.

## HTTP contract

The Worker preserves these response shapes and service error codes:

- `POST /runs`
- `GET /runs/active`
- `PUT /runs/:runId/checkpoint`
- `POST /runs/:runId/complete`
- `GET /leaderboard?limit=20`
- `GET /health`
- `GET /openapi.json`

Allowed browser origins receive credentialed CORS headers. An unconfigured
origin receives `403 {"error":"cors_origin_not_allowed"}`. A new browser gets
an HttpOnly `anonymous_player_id` cookie, and every D1 lookup remains scoped to
that player ID. Malformed JSON returns `400 {"error":"invalid_json"}`.

Swagger UI remains a local Express-only surface at `/docs`. The production
Worker serves the contract JSON at `/openapi.json`; keeping the UI out of the
Worker bundle avoids carrying the Node/Express adapter into the production
runtime and does not block core deployment.
