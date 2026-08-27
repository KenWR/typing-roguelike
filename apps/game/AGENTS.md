# Game client guidance

- Read `docs/ui-ux-principles.md` before UI implementation or review.
- Read `docs/run-api-persistence.md` for run persistence and `docs/game-workers-static-assets.md` for deployment behavior when relevant.
- Keep Phaser scene lifecycle cleanup explicit. Remove listeners, timers, tweens, and transient objects during shutdown.
- Put deterministic state transitions in pure helpers. Inject random sources and clocks at runtime boundaries.
- Keep asset paths and texture keys centralized; update asset contract tests with catalog changes.
- Run focused tests with `bun run --filter @typing-roguelike/game test`.
- User-visible changes require browser verification and current-commit screenshots after `bun run validate` passes.
