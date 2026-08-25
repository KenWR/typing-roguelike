export const DEFAULT_MAX_AP = 6;
export const DEFAULT_AP_REGENERATION_PER_SECOND = 1;

export type ActionPointResourceConfig = Readonly<{
  maxAp?: number;
  initialAp?: number;
  regenerationPerSecond?: number;
}>;

export type ActionPointSnapshot = Readonly<{
  currentAp: number;
  maxAp: number;
  regenerationPerSecond: number;
  paused: boolean;
}>;

export type ActionPointSpendResult = Readonly<{
  accepted: boolean;
  spentAp: number;
  missingAp: number;
  snapshot: ActionPointSnapshot;
}>;

const validateNonNegative = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }

  return value;
};

export class ActionPointResource {
  private currentAp: number;
  private readonly maxAp: number;
  private readonly regenerationPerSecond: number;
  private paused = false;

  constructor(config: ActionPointResourceConfig = {}) {
    this.maxAp = validateNonNegative(
      "Maximum AP",
      config.maxAp ?? DEFAULT_MAX_AP,
    );
    this.regenerationPerSecond = validateNonNegative(
      "AP regeneration per second",
      config.regenerationPerSecond ?? DEFAULT_AP_REGENERATION_PER_SECOND,
    );
    this.currentAp = Math.min(
      validateNonNegative("Initial AP", config.initialAp ?? this.maxAp),
      this.maxAp,
    );
  }

  get snapshot(): ActionPointSnapshot {
    return {
      currentAp: this.currentAp,
      maxAp: this.maxAp,
      regenerationPerSecond: this.regenerationPerSecond,
      paused: this.paused,
    };
  }

  trySpend(cost: number): ActionPointSpendResult {
    validateNonNegative("AP cost", cost);

    if (cost > this.currentAp) {
      return {
        accepted: false,
        spentAp: 0,
        missingAp: cost - this.currentAp,
        snapshot: this.snapshot,
      };
    }

    this.currentAp -= cost;
    return {
      accepted: true,
      spentAp: cost,
      missingAp: 0,
      snapshot: this.snapshot,
    };
  }

  advance(deltaMs: number): ActionPointSnapshot {
    validateNonNegative("AP delta", deltaMs);

    if (!this.paused) {
      this.currentAp = Math.min(
        this.currentAp + this.regenerationPerSecond * (deltaMs / 1_000),
        this.maxAp,
      );
    }

    return this.snapshot;
  }

  pause(): ActionPointSnapshot {
    this.paused = true;
    return this.snapshot;
  }

  resume(): ActionPointSnapshot {
    this.paused = false;
    return this.snapshot;
  }
}
