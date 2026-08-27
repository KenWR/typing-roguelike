import type { SkillConfig } from "../../content/types.ts";

export type SkillDamageEffect = Readonly<{
  type: "damage";
  coefficient: number;
}>;

/**
 * 커맨드 입력을 완성하는 즉시 시전자에게 부여되는 실드입니다.
 * `amount`만큼의 피해를 흡수하고 `durationMs`가 지나면 남은 양과 함께 사라집니다.
 */
export type SkillShieldEffect = Readonly<{
  type: "shield";
  amount: number;
  durationMs: number;
}>;

export type SkillStatusEffect = Readonly<{
  type: "status";
  statusId: string;
  durationMs: number;
  stacks?: number;
}>;

export type SkillEffect =
  | SkillDamageEffect
  | SkillShieldEffect
  | SkillStatusEffect;

export type SkillDefinitionInput = SkillConfig &
  Readonly<{
    effects?: readonly SkillEffect[];
  }>;

export type SkillDefinition = Readonly<
  SkillConfig & {
    effects: readonly SkillEffect[];
  }
>;

export type SkillActionContext = Readonly<{
  actionId: string;
  actorId: string;
  targetId: string;
}>;

export type SkillActionDefinition = Readonly<{
  id: string;
  actorId: string;
  targetId: string;
  windupMs: number;
  recoveryMs: number;
}>;

const requireText = (name: string, value: string): string => {
  if (value.trim().length === 0) {
    throw new RangeError(`${name} must not be empty.`);
  }

  return value;
};

const requireNonNegative = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }

  return value;
};

const normalizeEffect = (effect: SkillEffect): SkillEffect => {
  switch (effect.type) {
    case "damage":
      return Object.freeze({
        type: effect.type,
        coefficient: requireNonNegative(
          "Damage coefficient",
          effect.coefficient,
        ),
      });
    case "shield":
      return Object.freeze({
        type: effect.type,
        amount: requireNonNegative("Shield amount", effect.amount),
        durationMs: requireNonNegative("Shield duration", effect.durationMs),
      });
    case "status": {
      const stacks = effect.stacks ?? 1;
      if (!Number.isInteger(stacks) || stacks <= 0) {
        throw new RangeError("Status stacks must be a positive integer.");
      }

      return Object.freeze({
        type: effect.type,
        statusId: requireText("Status id", effect.statusId),
        durationMs: requireNonNegative("Status duration", effect.durationMs),
        stacks,
      });
    }
  }
};

const normalizeEffects = (
  input: SkillDefinitionInput,
): readonly SkillEffect[] => {
  const effects =
    input.effects ??
    (input.damageCoefficient === undefined
      ? []
      : [
          {
            type: "damage" as const,
            coefficient: input.damageCoefficient,
          },
        ]);

  return Object.freeze(effects.map(normalizeEffect));
};

export const defineSkill = (
  input: SkillDefinitionInput,
): SkillDefinition => {
  const definition: SkillDefinition = {
    ...input,
    id: requireText("Skill id", input.id),
    name: requireText("Skill name", input.name),
    command: requireText("Skill command", input.command),
    description: requireText("Skill description", input.description),
    apCost: requireNonNegative("Skill AP cost", input.apCost),
    windupMs: requireNonNegative("Skill windup", input.windupMs),
    recoveryMs: requireNonNegative("Skill recovery", input.recoveryMs),
    effects: normalizeEffects(input),
  };

  return Object.freeze(definition);
};

export const createSkillRegistry = (
  skills: readonly SkillDefinitionInput[],
): ReadonlyMap<string, SkillDefinition> => {
  const registry = new Map<string, SkillDefinition>();

  for (const input of skills) {
    const skill = defineSkill(input);
    if (registry.has(skill.id)) {
      throw new Error(`Duplicate skill id: ${skill.id}`);
    }
    registry.set(skill.id, skill);
  }

  return registry;
};

export const createSkillActionDefinition = (
  input: SkillDefinitionInput,
  context: SkillActionContext,
): SkillActionDefinition => {
  const skill = defineSkill(input);

  return Object.freeze({
    id: requireText("Action id", context.actionId),
    actorId: requireText("Actor id", context.actorId),
    targetId: requireText("Target id", context.targetId),
    windupMs: skill.windupMs,
    recoveryMs: skill.recoveryMs,
  });
};
