# Issue #280 implementation note

- Enemy windup timings are stored as explicit content values; no runtime 4x multiplier.
- Map generation excludes reward nodes.
- Rounds 1-8 can generate combat, elite (when an encounter exists), shop, or rest.
- Round 9 is exactly one rest node.
- Round 10 is exactly one boss node.
