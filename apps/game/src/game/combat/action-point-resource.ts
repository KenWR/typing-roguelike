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

type TimedRegenModifier = {
  amountPerSecond: number;
  remainingMs: number;
};

const validateNonNegative = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
  return value;
};

const validateFinite = (name: string, value: number): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  return value;
};

export class ActionPointResource {
  private currentAp: number;
  private readonly maxAp: number;
  private readonly regenerationPerSecond: number;
  private readonly timedRegenModifiers: TimedRegenModifier[] = [];
  private paused = false;

  constructor(config: ActionPointResourceConfig = {}) {
    this.maxAp = validateNonNegative("Maximum AP", config.maxAp ?? DEFAULT_MAX_AP);
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
      regenerationPerSecond:
        this.regenerationPerSecond +
        this.timedRegenModifiers.reduce((sum, modifier) => sum + modifier.amountPerSecond, 0),
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
    return { accepted: true, spentAp: cost, missingAp: 0, snapshot: this.snapshot };
  }

  /** 즉시 AP를 증감합니다. 결과는 항상 0~maxAp 사이로 제한됩니다. */
  adjust(delta: number): ActionPointSnapshot {
    validateFinite("AP adjustment", delta);
    this.currentAp = Math.min(this.maxAp, Math.max(0, this.currentAp + delta));
    return this.snapshot;
  }

  addTemporaryRegeneration(amountPerSecond: number, durationMs: number): ActionPointSnapshot {
    validateNonNegative("Temporary AP regeneration", amountPerSecond);
    validateNonNegative("Temporary AP regeneration duration", durationMs);
    if (durationMs > 0 && amountPerSecond !== 0) {
      this.timedRegenModifiers.push({ amountPerSecond, remainingMs: durationMs });
    }
    return this.snapshot;
  }

  advance(deltaMs: number): ActionPointSnapshot {
    validateNonNegative("AP delta", deltaMs);
    if (!this.paused) {
      let apDelta = this.regenerationPerSecond * (deltaMs / 1_000);
      for (const modifier of this.timedRegenModifiers) {
        const activeMs = Math.min(deltaMs, modifier.remainingMs);
        apDelta += modifier.amountPerSecond * (activeMs / 1_000);
      }
      this.currentAp = Math.min(this.maxAp, Math.max(0, this.currentAp + apDelta));

      for (let index = this.timedRegenModifiers.length - 1; index >= 0; index -= 1) {
        const modifier = this.timedRegenModifiers[index]!;
        modifier.remainingMs -= deltaMs;
        if (modifier.remainingMs <= 0) this.timedRegenModifiers.splice(index, 1);
      }
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
