export type OverlappingAttackDefinition = Readonly<{
  id: string;
  windupMs: number;
  recoveryMs: number;
}>;

export type ScheduledAttack = Readonly<{
  id: string;
  startAtMs: number;
  castCompletedAtMs: number;
  recoveryCompletedAtMs: number;
}>;

export type OverlappingAttackEvent = Readonly<{
  type: "attack-started" | "cast-completed" | "recovery-completed";
  attackId: string;
  atMs: number;
}>;

const validateDuration = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
  return value;
};

const validateId = (id: string): string => {
  if (id.trim().length === 0) {
    throw new RangeError("Attack id must not be empty.");
  }
  return id;
};

export const buildOverlappingAttackSchedule = (
  attacks: readonly OverlappingAttackDefinition[],
  initialStartAtMs = 0,
): readonly ScheduledAttack[] => {
  validateDuration("Initial start time", initialStartAtMs);

  let nextStartAtMs = initialStartAtMs;
  return attacks.map((attack) => {
    const windupMs = validateDuration("Windup duration", attack.windupMs);
    const recoveryMs = validateDuration("Recovery duration", attack.recoveryMs);
    const startAtMs = nextStartAtMs;
    const castCompletedAtMs = startAtMs + windupMs;
    const recoveryCompletedAtMs = castCompletedAtMs + recoveryMs;

    nextStartAtMs = castCompletedAtMs;

    return {
      id: validateId(attack.id),
      startAtMs,
      castCompletedAtMs,
      recoveryCompletedAtMs,
    };
  });
};

const EVENT_ORDER: Record<OverlappingAttackEvent["type"], number> = {
  "recovery-completed": 0,
  "cast-completed": 1,
  "attack-started": 2,
};

export const getOverlappingAttackEvents = (
  schedule: readonly ScheduledAttack[],
): readonly OverlappingAttackEvent[] =>
  schedule
    .flatMap((attack) => [
      { type: "attack-started" as const, attackId: attack.id, atMs: attack.startAtMs },
      { type: "cast-completed" as const, attackId: attack.id, atMs: attack.castCompletedAtMs },
      {
        type: "recovery-completed" as const,
        attackId: attack.id,
        atMs: attack.recoveryCompletedAtMs,
      },
    ])
    .sort(
      (left, right) =>
        left.atMs - right.atMs || EVENT_ORDER[left.type] - EVENT_ORDER[right.type],
    );

export type ScheduledAttackPhase = "pending" | "windup" | "recovery" | "resolved";

export const getScheduledAttackPhase = (
  attack: ScheduledAttack,
  elapsedMs: number,
): ScheduledAttackPhase => {
  validateDuration("Elapsed time", elapsedMs);

  if (elapsedMs < attack.startAtMs) {
    return "pending";
  }
  if (elapsedMs < attack.castCompletedAtMs) {
    return "windup";
  }
  if (elapsedMs < attack.recoveryCompletedAtMs) {
    return "recovery";
  }
  return "resolved";
};
