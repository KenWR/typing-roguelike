export type EnemyHealthView = Readonly<{
  name: string;
  currentHp: number;
  maxHp: number;
  label: string;
}>;

const clampHp = (value: number, maxHp: number): number =>
  Math.min(Math.max(0, value), Math.max(0, maxHp));

export const createEnemyHealthView = (
  name: string | undefined,
  currentHp: number | undefined,
  maxHp: number | undefined,
): EnemyHealthView => {
  const safeName = name?.trim() ? name : "알 수 없는 적";
  const safeMaxHp =
    typeof maxHp === "number" && Number.isFinite(maxHp)
      ? Math.max(0, maxHp)
      : 0;
  const safeCurrentHp =
    typeof currentHp === "number" && Number.isFinite(currentHp)
      ? clampHp(currentHp, safeMaxHp)
      : 0;

  return {
    name: safeName,
    currentHp: safeCurrentHp,
    maxHp: safeMaxHp,
    label: `${safeName}  HP ${safeCurrentHp} / ${safeMaxHp}`,
  };
};
