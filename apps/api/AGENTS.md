# API guidance

- Read `apps/api/README.md` and `docs/run-api-persistence.md` before changing API behavior.
- Treat request bodies, query values, cookies, and stored snapshots as untrusted input.
- Keep transport adapters thin and route behavior through the shared service and repository contracts.
- Inject clocks, identifiers, and random seed factories when deterministic tests need control.
- Do not log cookies, player identifiers, request bodies, secrets, or full state snapshots.
- Add D1 migrations as new ordered files. Use `--local` for local migration verification.
- Run focused tests with `bun run --filter @typing-roguelike/api test`.
