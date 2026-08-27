export type ComboBreakReason =
  | "incorrect-input"
  | "timeout"
  | "player-hit"
  | "manual";

export type ComboBonusTier = Readonly<{
  minimumCombo: number;
  multiplier: number;
}>;

export type ComboTrackerConfig = Readonly<{
  bonusTiers?: readonly ComboBonusTier[];
}>;

export type ComboSnapshot = Readonly<{
  count: number;
  multiplier: number;
  lastBreakReason: ComboBreakReason | null;
}>;

export const DEFAULT_COMBO_BONUS_TIERS = [
  { minimumCombo: 0, multiplier: 1 },
  { minimumCombo: 2, multiplier: 1.05 },
  { minimumCombo: 5, multiplier: 1.1 },
  { minimumCombo: 10, multiplier: 1.25 },
  { minimumCombo: 20, multiplier: 1.5 },
] as const satisfies readonly ComboBonusTier[];

const validateTiers = (
  tiers: readonly ComboBonusTier[],
): readonly ComboBonusTier[] => {
  if (tiers.length === 0) {
    throw new RangeError("Combo bonus tiers must not be empty.");
  }

  const normalized = [...tiers].sort(
    (left, right) => left.minimumCombo - right.minimumCombo,
  );

  if (normalized[0].minimumCombo !== 0) {
    throw new RangeError("Combo bonus tiers must start at combo 0.");
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const tier = normalized[index];

    if (!Number.isInteger(tier.minimumCombo) || tier.minimumCombo < 0) {
      throw new RangeError("Combo minimums must be non-negative integers.");
    }
    if (!Number.isFinite(tier.multiplier) || tier.multiplier <= 0) {
      throw new RangeError("Combo multipliers must be positive finite numbers.");
    }
    if (
      index > 0 &&
      normalized[index - 1].minimumCombo === tier.minimumCombo
    ) {
      throw new RangeError("Combo bonus tier minimums must be unique.");
    }
  }

  return normalized;
};

export class ComboTracker {
  private readonly bonusTiers: readonly ComboBonusTier[];
  private count = 0;
  private lastBreakReason: ComboBreakReason | null = null;

  constructor(config: ComboTrackerConfig = {}) {
    this.bonusTiers = validateTiers(
      config.bonusTiers ?? DEFAULT_COMBO_BONUS_TIERS,
    );
  }

  get snapshot(): ComboSnapshot {
    return {
      count: this.count,
      multiplier: this.resolveMultiplier(this.count),
      lastBreakReason: this.lastBreakReason,
    };
  }

  recordCorrectInput(): ComboSnapshot {
    this.count += 1;
    this.lastBreakReason = null;
    return this.snapshot;
  }

  breakCombo(reason: ComboBreakReason): ComboSnapshot {
    this.count = 0;
    this.lastBreakReason = reason;
    return this.snapshot;
  }

  applyBonus(baseValue: number): number {
    if (!Number.isFinite(baseValue) || baseValue < 0) {
      throw new RangeError("Combo bonus base value must be non-negative and finite.");
    }

    return baseValue * this.resolveMultiplier(this.count);
  }

  private resolveMultiplier(combo: number): number {
    let multiplier = this.bonusTiers[0].multiplier;

    for (const tier of this.bonusTiers) {
      if (combo < tier.minimumCombo) break;
      multiplier = tier.multiplier;
    }

    return multiplier;
  }
}
