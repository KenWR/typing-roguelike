export type EnemyHealthView = Readonly<{
  name: string;
  currentHp: number;
  maxHp: number;
  /** 선딜 중이라 남아 있는 실드량. 0이면 실드가 없습니다. */
  shield: number;
  targeted: boolean;
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

export type EnemyHealthViewOptions = Readonly<{
  shield?: number;
  targeted?: boolean;
}>;

/**
 * 지정 중인 적 앞에 붙는 표식입니다. 같은 목록의 비지정 적은 같은 폭의 공백으로
 * 맞추고, 지정 정보가 없는 호출에는 표식 자리를 만들지 않습니다.
 */
export const TARGET_MARKER = "▶";

const toShieldAmount = (shield: number | undefined): number =>
  typeof shield === "number" && Number.isFinite(shield) && shield > 0
    ? Math.round(shield)
    : 0;

export const createEnemyHealthView = (
  name: string | undefined,
  currentHp: number | undefined,
  maxHp: number | undefined,
  options: EnemyHealthViewOptions = {},
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

  const shield = toShieldAmount(options.shield);
  const targeted = options.targeted === true;
  const marker =
    options.targeted === undefined ? "" : targeted ? `${TARGET_MARKER} ` : "  ";
  const shieldLabel = shield > 0 ? `  실드 ${shield}` : "";

  return {
    name: safeName,
    currentHp: safeCurrentHp,
    maxHp: safeMaxHp,
    shield,
    targeted,
    label: `${marker}${safeName}  HP ${safeCurrentHp} / ${safeMaxHp}${shieldLabel}`,
  };
};

export type EnemyHealthListOptions = Readonly<{
  enemyShield?: Readonly<Record<string, number>>;
  targetId?: string | undefined;
}>;

export const createEnemyHealthListLabel = (
  enemies: readonly Readonly<{
    instanceId: string;
    name: string;
    hp: number;
  }>[],
  enemyHp: Readonly<Record<string, number>>,
  options: EnemyHealthListOptions = {},
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
        {
          shield: options.enemyShield?.[enemy.instanceId] ?? 0,
          ...(options.targetId === undefined
            ? {}
            : { targeted: options.targetId === enemy.instanceId }),
        },
      ).label,
    )
    .join("\n");
};
