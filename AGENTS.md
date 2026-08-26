# Repository agent map

## Start here

- Read `README.md` for the product boundary and workspace layout.
- Preserve unrelated user changes and keep each change within the requested scope.
- Use Bun 1.3.14 and the committed `bun.lock`; install with `bun install --frozen-lockfile`.

## Read by scope

- `apps/game/**`: read `apps/game/AGENTS.md`.
- `apps/api/**`: read `apps/api/AGENTS.md`.
- `packages/shared/**`: read `packages/shared/AGENTS.md`.
- `scripts/**` or `.codex/hooks/**`: read `scripts/AGENTS.md`.
- Codex agents and skills: read `.codex/README.md` and the selected skill file.
- Test selection and evidence: read `docs/agent/verification.md`.

## Completion contract

- Run focused tests while iterating, then run `bun run validate` on the final repository state.
- A changed task is complete only when `bun run validate` passes. Report environmental blockers separately from test failures.
- Keep `.github/workflows/pr-validation.yml` aligned with the same `bun run validate` command.

## Frontend evidence

- User-visible `apps/game` changes require typecheck, build, automated browser smoke verification, and a screenshot from the current commit.
- Put PR evidence in `Screenshots or recordings`. Include desktop and affected breakpoint screenshots for responsive changes.
- Keep verification screenshots out of Git unless the user requests committed artifacts.
