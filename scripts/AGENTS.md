# Script and hook guidance

- Use fail-fast behavior and preserve child exit codes.
- Resolve repository paths from the Git root and quote every path that can contain spaces.
- Keep destructive targets explicit and bounded. Use temporary directories with guaranteed cleanup.
- Mock external CLIs and network effects in fixture tests.
- Hook output must be concise, contain no secrets, and follow the documented Codex JSON contract.
- Run `.codex/hooks/quality-gate.test.ts` after Hook changes, then finish with `bun run validate`.
