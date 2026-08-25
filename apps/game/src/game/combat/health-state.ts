export const DEFAULT_MAX_HP = 100;

export type HealthStateConfig = Readonly<{
  maxHp?: number;
  initialHp?: number;
}>;

export type HealthSnapshot = Readonly<{
  currentHp: number;
  maxHp: number;
  isDead: boolean;
}>;

export type DamageResult = Readonly<{
  appliedDamage: number;
  deathOccurred: boolean;
  snapshot: HealthSnapshot;
}>;

const validatePositive = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }

  return value;
};

const validateNonNegative = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }

  return value;
};

export class HealthState {
  private currentHp: number;
  private readonly maxHp: number;

  constructor(config: HealthStateConfig = {}) {
    this.maxHp = validatePositive("Maximum HP", config.maxHp ?? DEFAULT_MAX_HP);
    this.currentHp = Math.min(
      validateNonNegative("Initial HP", config.initialHp ?? this.maxHp),
      this.maxHp,
    );
  }

  get snapshot(): HealthSnapshot {
    return {
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      isDead: this.currentHp === 0,
    };
  }

  applyDamage(damage: number): DamageResult {
    validateNonNegative("Damage", damage);

    const previousHp = this.currentHp;
    this.currentHp = Math.max(0, this.currentHp - damage);

    return {
      appliedDamage: previousHp - this.currentHp,
      deathOccurred: previousHp > 0 && this.currentHp === 0,
      snapshot: this.snapshot,
    };
  }
}
