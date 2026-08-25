export type DamageCalculationInput = Readonly<{
  attackPower: number;
  damageCoefficient: number;
  defense: number;
}>;

const validateNonNegative = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }

  return value;
};

export const calculateDamage = ({
  attackPower,
  damageCoefficient,
  defense,
}: DamageCalculationInput): number => {
  const baseDamage =
    validateNonNegative("Attack power", attackPower) *
    validateNonNegative("Damage coefficient", damageCoefficient);
  const validatedDefense = validateNonNegative("Defense", defense);

  if (!Number.isFinite(baseDamage)) {
    throw new RangeError("Base damage must be finite.");
  }

  const defenseReduction = validatedDefense / (validatedDefense + 100);
  const finalDamage = Math.round(baseDamage * (1 - defenseReduction));

  return Math.max(1, finalDamage);
};
