import type {
  SkillDefinition,
  SkillGuardEffect,
  SkillStatusEffect,
} from "@typing-roguelike/shared";
import type { CombatActionEvent } from "./combat-state";
import { calculateDamage } from "./damage-formula";
import { HealthState, type HealthSnapshot } from "./health-state";

export type ActiveGuardEffect = Readonly<{
  damageMultiplier: number;
  durationMs: number;
}>;

export type ActiveStatusEffect = Readonly<{
  statusId: string;
  durationMs: number;
  stacks: number;
}>;

export type SkillCombatantSnapshot = Readonly<{
  id: string;
  attackPower: number;
  defense: number;
  health: HealthSnapshot;
  guards: readonly ActiveGuardEffect[];
  statuses: readonly ActiveStatusEffect[];
}>;

export type SkillCombatantConfig = Readonly<{
  id: string;
  attackPower: number;
  defense: number;
  maxHp?: number;
  initialHp?: number;
}>;

const validateIdentifier = (name: string, value: string): string => {
  if (value.trim().length === 0) {
    throw new RangeError(`${name} must not be empty.`);
  }
  return value;
};

const validateNonNegative = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
  return value;
};

export class SkillCombatantState {
  readonly id: string;
  readonly attackPower: number;
  readonly health: HealthState;
  private readonly baseDefense: number;
  private temporaryDefense = 0;
  private readonly guards: ActiveGuardEffect[] = [];
  private readonly statuses: ActiveStatusEffect[] = [];

  constructor(config: SkillCombatantConfig) {
    this.id = validateIdentifier("Combatant id", config.id);
    this.attackPower = validateNonNegative("Attack power", config.attackPower);
    this.baseDefense = validateNonNegative("Defense", config.defense);
    this.health = new HealthState({ maxHp: config.maxHp, initialHp: config.initialHp });
  }

  get defense(): number {
    return this.baseDefense + this.temporaryDefense;
  }

  get snapshot(): SkillCombatantSnapshot {
    return {
      id: this.id,
      attackPower: this.attackPower,
      defense: this.defense,
      health: this.health.snapshot,
      guards: [...this.guards],
      statuses: [...this.statuses],
    };
  }

  applyGuard(effect: SkillGuardEffect): void {
    this.guards.push({
      damageMultiplier: effect.damageMultiplier,
      durationMs: effect.durationMs,
    });
  }

  applyStatus(effect: SkillStatusEffect): void {
    this.statuses.push({
      statusId: effect.statusId,
      durationMs: effect.durationMs,
      stacks: effect.stacks ?? 1,
    });
  }

  setTemporaryDefense(defense: number): void {
    this.temporaryDefense = validateNonNegative("Temporary defense", defense);
  }

  clearTemporaryDefense(): void {
    this.temporaryDefense = 0;
  }
}

export type ResolveSkillImpactInput = Readonly<{
  event: CombatActionEvent;
  skill: SkillDefinition;
  actor: SkillCombatantState;
  target: SkillCombatantState;
}>;

export type SkillImpactResult = Readonly<{
  applied: boolean;
  actionId: string;
  damageApplied: number;
  guardEffectsApplied: number;
  statusEffectsApplied: number;
}>;

export class SkillImpactResolver {
  private readonly resolvedActionIds = new Set<string>();

  resolve({ event, skill, actor, target }: ResolveSkillImpactInput): SkillImpactResult {
    if (event.type !== "impact-resolved") {
      return this.emptyResult(event.actionId);
    }
    if (this.resolvedActionIds.has(event.actionId)) {
      return this.emptyResult(event.actionId);
    }
    if (event.actorId !== actor.id || event.targetId !== target.id) {
      throw new Error(`Skill impact participants do not match action ${event.actionId}.`);
    }

    let damageApplied = 0;
    let guardEffectsApplied = 0;
    let statusEffectsApplied = 0;

    for (const effect of skill.effects) {
      switch (effect.type) {
        case "damage": {
          const damage = calculateDamage({
            attackPower: actor.attackPower,
            damageCoefficient: effect.coefficient,
            defense: target.defense,
          });
          damageApplied += target.health.applyDamage(damage).appliedDamage;
          break;
        }
        case "guard":
          actor.applyGuard(effect);
          guardEffectsApplied += 1;
          break;
        case "status":
          target.applyStatus(effect);
          statusEffectsApplied += 1;
          break;
      }
    }

    this.resolvedActionIds.add(event.actionId);
    return {
      applied: true,
      actionId: event.actionId,
      damageApplied,
      guardEffectsApplied,
      statusEffectsApplied,
    };
  }

  private emptyResult(actionId: string): SkillImpactResult {
    return {
      applied: false,
      actionId,
      damageApplied: 0,
      guardEffectsApplied: 0,
      statusEffectsApplied: 0,
    };
  }
}
