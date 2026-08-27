# Cloudflare production deployment

This repository deploys production to Cloudflare through `.github/workflows/deploy.yml`.
The workflow runs only after `PR validation` succeeds for a push to `main`, verifies that the validated SHA is still the current `origin/main`, then performs the deployment in this order:

1. Apply remote D1 migrations.
2. Dry-run and deploy the API Worker.
3. Build the game with the production API origin.
4. Dry-run and deploy the game Workers Static Assets Worker.
5. Smoke-test `GET /health` on the API.
6. Smoke-test the production game HTML shell.

The workflow uses repository-level GitHub Actions secrets and variables. It does not require a GitHub Environment.

## Cloudflare resource contract

| Resource     | Contract                                                    |
| ------------ | ----------------------------------------------------------- |
| API Worker   | `typing-roguelike-api`, entrypoint `apps/api/src/worker.ts` |
| D1 binding   | `DB`, migrations in `apps/api/migrations`                   |
| Game Worker  | `typing-roguelike-game`, assets in `apps/game/dist`         |
| Game routing | `not_found_handling = "single-page-application"`            |

The workflow creates a temporary Wrangler config on the Actions runner, injects the configured production D1 name and ID, and preserves the checked-in `DB` binding. If production D1 metadata is already checked into `apps/api/wrangler.toml`, the repository Actions variables must match it.

## GitHub Actions setup

Open the repository and go to:

`Settings -> Secrets and variables -> Actions`

Do not commit secrets or `.env` files.

### Repository secret

Add this under **Secrets**:

| Name                   | Purpose                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token used for remote D1 migrations and Worker deployments |

Use a scoped Cloudflare API token rather than a Global API Key. Grant only the permissions required for Workers deployment and D1 migration operations for the target account.

### Repository variables

Add these under **Variables**:

| Name                          | Value contract                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`       | 32-character Cloudflare account ID                                                |
| `CLOUDFLARE_API_WORKER_NAME`  | Must match `apps/api/wrangler.toml`; production value is `typing-roguelike-api`   |
| `CLOUDFLARE_GAME_WORKER_NAME` | Must match `apps/game/wrangler.toml`; production value is `typing-roguelike-game` |
| `CLOUDFLARE_D1_DATABASE_NAME` | Actual production D1 database name                                                |
| `CLOUDFLARE_D1_DATABASE_ID`   | Actual production D1 database UUID                                                |
| `PRODUCTION_API_URL`          | Public HTTPS API origin with no trailing slash                                    |
| `PRODUCTION_GAME_URL`         | Public HTTPS game origin with no trailing slash                                   |

`PRODUCTION_API_URL` is embedded into the game build as `VITE_API_BASE_URL`.
The API deployment receives `API_ORIGIN`, `CORS_ORIGIN=$PRODUCTION_GAME_URL`, and `COOKIE_SECURE=true`.
Do not place credentials or secrets in URLs or any `VITE_*` variable.

## First-time release

1. Create or confirm the production D1 database.
2. Add `CLOUDFLARE_API_TOKEN` to repository Actions Secrets.
3. Add all seven repository Actions Variables listed above.
4. Confirm the D1 name and UUID match `apps/api/wrangler.toml` when production metadata is checked in.
5. Confirm both production URLs are HTTPS origins without a trailing slash.
6. Merge the reviewed deployment workflow to `main`.
7. Wait for `PR validation` on the `main` push to succeed.
8. Review the `Production deployment` workflow summary and confirm all deployment and smoke-test stages succeeded.

## Re-run and partial failure

Use GitHub Actions **Re-run jobs** after correcting a repository secret/variable or an external Cloudflare issue. The workflow still checks that the validated SHA is the current `main`; if `main` has advanced, use the newer validated run instead.

The final summary runs with `if: always()` and reports each ordered stage as `success`, `failure`, or `skipped`.

- D1 migration failure: API/game deployment is skipped. Fix the D1/token problem and re-run. Wrangler migration history makes already-applied migrations safe to re-run.
- API deployment failure: D1 changes remain applied; game deployment is skipped.
- Game build/deploy failure: API may already be deployed; smoke tests are skipped.
- Smoke-test failure: deployment remains in place; investigate before re-running. No automatic rollback is performed.

The workflow uses serialized concurrency with `cancel-in-progress: false`, so an active production deployment is not cancelled by a newer one.

## Rollback

Use a reviewed forward revert through `main`:

1. Revert the problematic change in a pull request.
2. Merge the revert after validation.
3. Let the normal production workflow deploy the new `main` state.

Do not force-push `main` and do not apply unreviewed reverse SQL migrations. Destructive D1 recovery must use an approved backup/recovery procedure.

## Validation boundary

Without production credentials, workflow syntax, repository checks, builds, and Wrangler dry-runs can be validated locally or in CI. Remote D1 migration, Worker upload, and public production smoke tests remain `NOT_RUN` until the repository-level Actions secret and variables are configured.
