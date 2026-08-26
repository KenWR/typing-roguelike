# Cloudflare production deployment

This repository deploys three Cloudflare resources in one serialized production
workflow:

1. Apply the checked-in D1 migrations remotely.
2. Deploy the API Worker.
3. Build the game and deploy its Workers Static Assets Worker.
4. Check the API health endpoint and the deployed game URL.

The workflow is `.github/workflows/deploy.yml`. It runs after the existing
`PR validation` workflow completes successfully for a `push` to `main`. The
deployment job also checks that the validated SHA is the current `origin/main`
SHA at startup. Pull request validation runs do not deploy. Failed or cancelled
main validation runs do not deploy.

## Cloudflare resource contract

The checked-in Wrangler contracts define the following resources:

| Resource       | Checked-in contract                                                   |
| -------------- | --------------------------------------------------------------------- |
| API Worker     | `typing-roguelike-api`, `apps/api/src/worker.ts`                      |
| API D1 binding | `DB`, migrations in `apps/api/migrations`                             |
| Game Worker    | `typing-roguelike-game`, assets in `apps/game/dist`                   |
| Game routing   | SPA fallback through `not_found_handling = "single-page-application"` |

The production D1 name and ID are supplied through the GitHub `production`
Environment. The workflow creates a short-lived runner-temporary Wrangler
config, replaces the D1 name and ID with those Environment values, and preserves
the checked-in `DB` binding. This works whether `apps/api/wrangler.toml`
contains local placeholders or production metadata. When production metadata is
checked in, the workflow requires identical Environment values so workflow and
direct deployments target the same database. The temporary config uses
absolute repository paths and is not written to the repository, job summary,
logs, or artifacts.

## GitHub Environment setup

Create an Environment named `production` and restrict deployments to the
repository's protected `main` branch. Add required reviewers when a human
approval is part of the production release policy. The workflow references this
Environment explicitly. Configure these workflow values in the Environment.
Do not commit secrets or `.env` files. Non-secret D1 metadata may also be kept
in `apps/api/wrangler.toml`; keep both copies synchronized.

### Secret

| Name                   | Purpose                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token scoped to this account and the Workers deployment plus D1 migration operations |

Keep the token account-scoped and limited to the permissions required for these
two operations. Do not use a global API key, and do not print the token in
diagnostics. The token is injected only into the D1 migration, API deployment,
and game upload steps; checkout, dependency installation, configuration checks,
game build, and smoke tests do not receive it. The workflow grants GitHub
Actions only `contents: read`.

### Variables

| Name                          | Value contract                                                      |
| ----------------------------- | ------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`       | 32-character Cloudflare account ID                                  |
| `CLOUDFLARE_API_WORKER_NAME`  | Must be `typing-roguelike-api` and match `apps/api/wrangler.toml`   |
| `CLOUDFLARE_GAME_WORKER_NAME` | Must be `typing-roguelike-game` and match `apps/game/wrangler.toml` |
| `CLOUDFLARE_D1_DATABASE_NAME` | Actual production D1 database name                                  |
| `CLOUDFLARE_D1_DATABASE_ID`   | Actual production D1 database UUID                                  |
| `PRODUCTION_API_URL`          | Public HTTPS API origin without a trailing slash                    |
| `PRODUCTION_GAME_URL`         | Public HTTPS game origin without a trailing slash                   |

`PRODUCTION_API_URL` is embedded into the game build as
`VITE_API_BASE_URL`. The API Worker receives `API_ORIGIN`, `CORS_ORIGIN` set to
`PRODUCTION_GAME_URL`, and `COOKIE_SECURE=true` as deployment variables. These
values are public runtime configuration; never put a token or other secret in
either URL or in a `VITE_*` variable.

## First-time release

1. Provision the production D1 database and record its name and UUID in the
   `production` Environment variables.
2. Create the Cloudflare API token and save it only as the
   `CLOUDFLARE_API_TOKEN` Environment secret.
3. Create the production Environment variables, including both public HTTPS
   origins. Confirm the API CORS origin is the game origin.
4. Configure environment protection rules and required reviewers according to
   the production release policy.
5. Merge the reviewed change to `main`. The main push starts `PR validation`;
   the production deployment waits for its successful completion and any
   Environment approval.
6. Review the deployment summary for the validated SHA, resource names, D1
   database name, URLs, ordered stage outcomes, and smoke-test results.

The initial remote migration is run with Wrangler's `d1 migrations apply
<database> --remote` command. Wrangler records applied migrations and captures
a backup. The API upload starts only after that command succeeds.

## Re-run and partial failure

Use the GitHub Actions re-run action for the failed production workflow after
fixing the environment or external issue. A re-run remains subject to the
`production` Environment and the current-main check. If `main` has advanced,
wait for the new main validation run instead of deploying an older SHA.

The summary is written with `if: always()` and records each stage as
`success`, `failure`, or `skipped`:

- A D1 migration failure stops the API and game stages. Resolve the D1 or token
  issue, then re-run. Already applied migrations are skipped by Wrangler.
- An API deployment failure leaves D1 migrations applied and skips the game
  stage. Re-run after resolving the Worker configuration or Cloudflare issue.
- A game build or Static Assets deployment failure leaves the API deployment in
  place and skips smoke tests. Re-run after resolving the build or asset issue.
- A smoke-test failure marks the workflow failed and does not perform an
  automatic rollback. Inspect the URLs and stage outcomes before retrying.

The workflow uses one concurrency group with `cancel-in-progress: false`, so
an in-progress deployment is not cancelled. GitHub Actions' default
`queue: single` behavior keeps at most one pending run per concurrency group: if
another validation completes while a run is pending, the newer run replaces the
older pending run. Production deployments therefore intentionally coalesce to
the newest validated `main` commit rather than forming a lossless queue, and a
superseded pending run does not get its own deployment summary. The main-SHA
check prevents a stale pending run from mutating production if `main` advances
before that run starts.

## Rollback

The normal rollback is a forward, reviewed revert:

1. Revert the problematic main change in a reviewed pull request.
2. Let the resulting `main` push pass `PR validation`.
3. Allow the production workflow to apply any required forward-compatible D1
   migration, deploy the API, deploy the game, and run both smoke tests.

Do not use a force-push to make an old commit look current. Do not run an
unreviewed reverse SQL migration. D1 schema changes must remain compatible with
the API version during the transition; a destructive data or schema recovery
requires the approved Cloudflare backup/recovery procedure. An emergency
Cloudflare Worker version rollback is an operator action and must be followed
by the same API/game compatibility and health checks.

## Local validation boundary

The implementation can be validated without Cloudflare credentials by checking
workflow syntax, installing the frozen lockfile, running the repository checks,
and running Wrangler dry-runs against the checked-in configuration. Dry-runs
do not change a remote D1 database or upload either Worker; those remote
commands are intentionally excluded from local validation.

Production deployment, production smoke tests, and credential validation are
`NOT_RUN` in this change when the `production` Environment is not configured.
