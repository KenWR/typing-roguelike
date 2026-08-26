# Game Worker deployment

The game is deployed as a Cloudflare Workers Static Assets SPA. `apps/game/wrangler.toml` names the frontend Worker `typing-roguelike-game`, uploads `apps/game/dist`, and serves `index.html` for unmatched navigation requests so direct routes and refreshes continue to work.

The frontend Worker and API Worker remain separate resources. This task does not add API routes, an API binding, secrets, or a Worker script. The game calls the API origin compiled into the client through `VITE_API_BASE_URL`; the API Worker URL remains a generic deployment input until issue #259 provides it.

The configuration intentionally does not claim a custom domain. The initial Worker can use its Cloudflare-provided `workers.dev` hostname; a custom domain can be attached later after the frontend and API origins are agreed.

## Environment contract

Vite embeds `VITE_API_BASE_URL` at build time. The value must be an absolute API origin without a trailing slash.

| Environment | Vite mode | API URL source | Expected value |
| --- | --- | --- | --- |
| Development | `development` | `.env.development.local` or the shell | `http://localhost:3000` by default |
| Preview | `preview` | `.env.preview.local` or the shell | Preview API Worker origin |
| Production | `production` | `.env.production.local` or the shell | Production API Worker origin |

The client keeps the localhost fallback only for development. Preview and production builds have an empty API base when the variable is omitted, which makes the missing configuration fail through the existing bounded API retry and visible local-fallback status instead of silently targeting localhost. `VITE_*` values are public build output, so do not place secrets in them.

The API must allow the deployed game origin through its CORS policy and support credentialed requests. API URL, CORS, and API Worker deployment remain part of the API work in issue #259.

## Local development

From the repository root, start the API and game in separate terminals:

```bash
bun run dev:api
bun run dev:game
```

The game uses `http://localhost:3000` when `VITE_API_BASE_URL` is unset in development. To make the value explicit, copy `apps/game/.env.example` to `apps/game/.env.development.local` and keep the development value there.

## Production build and Vite preview

Build with the API origin that belongs to the environment. The API origin is embedded in the generated JavaScript, so changing it requires a new build.

```bash
VITE_API_BASE_URL=https://api-preview.example.com bun run --filter @typing-roguelike/game build
```

Serve the resulting `apps/game/dist` locally:

```bash
bun run --filter @typing-roguelike/game preview -- --host 127.0.0.1 --port 4173
```

For a distinct Vite preview mode, run the command from `apps/game` after setting the preview API origin:

```bash
cd apps/game
VITE_API_BASE_URL=https://api-preview.example.com bunx vite build --mode preview
bunx vite preview --host 127.0.0.1 --port 4173
```

## Wrangler validation and deployment

The commands below pin Wrangler to the version used for validation. Run them from `apps/game` so `./dist` resolves next to `wrangler.toml`.

```bash
cd apps/game
bunx wrangler@4.126.0 deploy --dry-run
bunx wrangler@4.126.0 dev --local --port 8787
```

With the local Wrangler server running, a browser navigation to `/` and to an application path such as `/run/active` should return the same SPA shell. A request that represents browser navigation can be checked with:

```bash
curl -i -H 'Sec-Fetch-Mode: navigate' http://127.0.0.1:8787/run/active
```

The response should be `200` and contain the built `index.html`. Static asset requests such as `/assets/<hashed-file>` should return the asset itself. A plain API request must continue to target the separately configured API origin.

After Cloudflare authentication and the API URL are available, deploy the frontend Worker from `apps/game`:

```bash
bunx wrangler@4.126.0 deploy
```

No production deployment or public URL verification is included in this change. The remaining production blockers are the API Worker URL and its CORS configuration from #259, followed by Cloudflare authentication and the separate public HTTPS browser test.

## Failure-state behavior

Run API requests make at most two attempts with a 2.5 second timeout per attempt. When the API remains unavailable, the current game flow continues with local persistence and the map HUD displays `저장: 로컬 fallback · ...`. This is the user-identifiable failure state used by the frontend Worker deployment; no Phaser Scene/UI change is required for this task.
