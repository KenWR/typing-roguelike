# Verification map

Install the exact dependency graph once per fresh worktree:

```bash
bun install --frozen-lockfile
```

## Focused checks

| Change | During iteration |
|---|---|
| Shared contracts and rules | `bun test packages/shared/tests` |
| Game logic and presentation | `bun run --filter @typing-roguelike/game test` |
| API, repository, and Worker | `bun run --filter @typing-roguelike/api test` |
| Codex quality Hook | `bun test .codex/hooks/quality-gate.test.ts` |
| Changed source formatting | `bun run format` |

## Final gate

Run this command from the repository root after all edits:

```bash
bun run validate
```

It checks changed-file formatting and lint, whitespace, the complete TypeScript workspace, all Bun tests, the Codex Hook, production builds, and desktop/mobile browser smoke tests.

Record failures by command and preserve the distinction between product failures and missing tools, browsers, credentials, network, or runtime dependencies. UI evidence must come from the same final commit or working-tree state that passed the gate.
