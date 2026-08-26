export type EnemyHealthView = Readonly<{
  name: string;
  currentHp: number;
  maxHp: number;
  label: string;
}>;

export type EnemyHealthEntry = Readonly<{
  instanceId: string;
  name: string;
  currentHp: number;
  maxHp: number;
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

export const createEnemyHealthListLabel = (
  enemies: readonly Readonly<{
    instanceId: string;
    name: string;
    hp: number;
  }>[],
  enemyHp: Readonly<Record<string, number>>,
): string => {
  if (enemies.length === 0) {
    return createEnemyHealthView(undefined, undefined, undefined).label;
  }

  return enemies
    .map((enemy) =>
      createEnemyHealthView(
        enemy.name,
        enemyHp[enemy.instanceId] ?? enemy.hp,
        enemy.hp,
      ).label,
    )
    .join("\n");
};
