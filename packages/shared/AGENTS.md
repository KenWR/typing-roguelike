# Shared contract guidance

- Treat this package as the canonical client-server contract and deterministic rules layer.
- Keep it independent of Phaser, Express, browser globals, Node-only APIs, storage, and network access.
- The same explicit input and seed must produce the same ordered output.
- Pass random sources, clocks, and identifiers into rules that need entropy or time.
- Validate public inputs at contract boundaries and preserve safe-integer rules for persisted numeric values.
- Update game and API consumers with every exported contract change.
- Run focused tests with `bun test packages/shared/tests` and finish with the root validation command.
