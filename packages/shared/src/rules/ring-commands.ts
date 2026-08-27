import { RING_BY_ID } from "../content/rings.ts";
import type {
  RingConfig,
  RingSkillModifier,
  SkillConfig,
  SkillEffectConfig,
} from "../content/types.ts";

export const MAX_RING_DAMAGE_MULTIPLIER = 2;

export type ResolvedSkillCommand = Readonly<{
  command: string;
  prefix?: string;
  baseCommand: string;
  suffix?: string;
  baseSkill: SkillConfig;
  skill: SkillConfig;
  modifiers: readonly RingSkillModifier[];
  sourceRingIds: readonly string[];
}>;

const appliesToSkill = (
  modifier: RingSkillModifier,
  skill: SkillConfig,
): boolean =>
  modifier.skillCategories === undefined ||
  modifier.skillCategories.includes(skill.category);

const validatePositiveMultiplier = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
  return value;
};

const normalizeStatusEffect = (
  status: NonNullable<RingSkillModifier["onHitStatus"]>,
): SkillEffectConfig => {
  if (status.statusId.trim().length === 0) {
    throw new RangeError("Ring status id must not be empty.");
  }
  if (!Number.isFinite(status.durationMs) || status.durationMs < 0) {
    throw new RangeError("Ring status duration must be a finite non-negative number.");
  }
  const stacks = status.stacks ?? 1;
  if (!Number.isInteger(stacks) || stacks <= 0) {
    throw new RangeError("Ring status stacks must be a positive integer.");
  }
  return {
    type: "status",
    statusId: status.statusId,
    durationMs: status.durationMs,
    stacks,
  };
};

const collectApplicableModifiers = (
  skill: SkillConfig,
  rings: readonly RingConfig[],
): readonly RingSkillModifier[] =>
  rings.flatMap((ring) =>
    ring.modifiers.filter((modifier) => appliesToSkill(modifier, skill)),
  );

export const applyRingModifiersToSkill = (
  skill: SkillConfig,
  rings: readonly RingConfig[],
): SkillConfig => {
  const modifiers = collectApplicableModifiers(skill, rings);
  const apCostDelta = modifiers.reduce(
    (sum, modifier) => sum + (modifier.apCostDelta ?? 0),
    0,
  );
  const windupMultiplier = modifiers.reduce(
    (product, modifier) =>
      product * validatePositiveMultiplier(
        "Ring windup multiplier",
        modifier.windupMultiplier ?? 1,
      ),
    1,
  );
  const uncappedDamageMultiplier = modifiers.reduce(
    (product, modifier) =>
      product * validatePositiveMultiplier(
        "Ring damage multiplier",
        modifier.damageMultiplier ?? 1,
      ),
    1,
  );
  const damageMultiplier = Math.min(
    MAX_RING_DAMAGE_MULTIPLIER,
    uncappedDamageMultiplier,
  );

  const sourceEffects = skill.effects ??
    (skill.damageCoefficient === undefined
      ? []
      : [{ type: "damage" as const, coefficient: skill.damageCoefficient }]);
  const effects: SkillEffectConfig[] = sourceEffects.map((effect) =>
    effect.type === "damage"
      ? { ...effect, coefficient: effect.coefficient * damageMultiplier }
      : { ...effect },
  );
  for (const modifier of modifiers) {
    if (modifier.onHitStatus !== undefined) {
      effects.push(normalizeStatusEffect(modifier.onHitStatus));
    }
  }

  return {
    ...skill,
    apCost: Math.max(0, skill.apCost + apCostDelta),
    windupMs: Math.max(0, skill.windupMs * windupMultiplier),
    ...(skill.damageCoefficient === undefined
      ? {}
      : { damageCoefficient: skill.damageCoefficient * damageMultiplier }),
    effects,
  };
};

const joinCommand = (
  prefix: RingConfig | undefined,
  baseCommand: string,
  suffix: RingConfig | undefined,
): string =>
  [prefix?.commandAffix, baseCommand, suffix?.commandAffix]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(" ");

const toResolved = (
  baseSkill: SkillConfig,
  prefix: RingConfig | undefined,
  suffix: RingConfig | undefined,
): ResolvedSkillCommand => {
  const rings = [prefix, suffix].filter(
    (ring): ring is RingConfig => ring !== undefined,
  );
  const modifiers = collectApplicableModifiers(baseSkill, rings);
  const command = joinCommand(prefix, baseSkill.command, suffix);
  return {
    command,
    ...(prefix === undefined ? {} : { prefix: prefix.commandAffix }),
    baseCommand: baseSkill.command,
    ...(suffix === undefined ? {} : { suffix: suffix.commandAffix }),
    baseSkill,
    skill: {
      ...applyRingModifiersToSkill(baseSkill, rings),
      command,
    },
    modifiers,
    sourceRingIds: rings.map((ring) => ring.id),
  };
};

/**
 * 원본 커맨드는 항상 유지하고, 장착된 반지로 만들 수 있는 prefix/suffix 조합을 추가한다.
 * 같은 position의 반지 둘을 동시에 한 커맨드에 겹쳐 붙이지 않아 한 스킬에 반지 효과가
 * 최대 두 개(prefix 1 + suffix 1)만 적용되도록 보장한다.
 */
export const resolveSkillCommands = (
  baseSkill: SkillConfig,
  equippedRingIds: readonly (string | null | undefined)[],
): readonly ResolvedSkillCommand[] => {
  const equipped = equippedRingIds.flatMap((ringId) => {
    if (ringId === null || ringId === undefined) return [];
    const ring = RING_BY_ID.get(ringId);
    return ring === undefined ? [] : [ring];
  });
  const prefixes = equipped.filter((ring) => ring.position === "prefix");
  const suffixes = equipped.filter((ring) => ring.position === "suffix");

  const resolved: ResolvedSkillCommand[] = [toResolved(baseSkill, undefined, undefined)];
  for (const prefix of prefixes) {
    resolved.push(toResolved(baseSkill, prefix, undefined));
  }
  for (const suffix of suffixes) {
    resolved.push(toResolved(baseSkill, undefined, suffix));
  }
  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      resolved.push(toResolved(baseSkill, prefix, suffix));
    }
  }

  const seen = new Set<string>();
  return resolved.filter(({ command }) => {
    const normalized = command.normalize("NFC");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const resolveSkillsWithRings = (
  baseSkills: readonly SkillConfig[],
  equippedRingIds: readonly (string | null | undefined)[],
): readonly ResolvedSkillCommand[] =>
  baseSkills.flatMap((skill) => resolveSkillCommands(skill, equippedRingIds));

export const findResolvedSkillCommand = (
  resolved: readonly ResolvedSkillCommand[],
  command: string,
): ResolvedSkillCommand | undefined => {
  const normalized = command.normalize("NFC");
  return resolved.find(
    (candidate) => candidate.command.normalize("NFC") === normalized,
  );
};
