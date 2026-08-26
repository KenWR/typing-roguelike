import type { SkillStatusEffect } from "@typing-roguelike/shared";
import { calculateDamage } from "./damage-formula";
import { DefenseWindowTracker } from "./defense-window";
import type { EnemyAttackEvent } from "./enemy-attack-timeline";
import { SkillCombatantState } from "./skill-impact-resolver";

export type ResolveEnemyImpactInput = Readonly<{
  event: EnemyAttackEvent;
  damage: number;
  target: SkillCombatantState;
  defenseWindows: DefenseWindowTracker;
  defendedDamageMultiplier: number;
  statusEffects?: readonly SkillStatusEffect[];
}>;

export type EnemyImpactResult = Readonly<{
  applied: boolean;
  timelineId: string;
  defended: boolean;
  damageApplied: number;
  statusEffectsApplied: number;
}>;

const validateNonNegative = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
  return value;
};

const validateDamageMultiplier = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(
      "Defended damage multiplier must be a finite number between 0 and 1.",
    );
  }
  return value;
};

export class EnemyImpactResolver {
  private readonly resolvedTimelineIds = new Set<string>();

  resolve({
    event,
    damage,
    target,
    defenseWindows,
    defendedDamageMultiplier,
    statusEffects = [],
  }: ResolveEnemyImpactInput): EnemyImpactResult {
    if (event.type !== "impact-resolved") {
      return this.emptyResult(event.timelineId);
    }
    if (this.resolvedTimelineIds.has(event.timelineId)) {
      return this.emptyResult(event.timelineId);
    }
    if (event.targetId !== target.id) {
      throw new Error(
        `Enemy impact target does not match timeline ${event.timelineId}.`,
      );
    }

    if (event.attackType === "defense") {
      this.resolvedTimelineIds.add(event.timelineId);
      return {
        applied: true,
        timelineId: event.timelineId,
        defended: false,
        damageApplied: 0,
        statusEffectsApplied: 0,
      };
    }

    const baseDamage = calculateDamage({
      attackPower: validateNonNegative("Enemy attack damage", damage),
      damageCoefficient: 1,
      defense: target.defense,
    });
    const defended = defenseWindows.resolveImpact(
      target.id,
      event.atMs,
    ).defended;
    const multiplier = defended
      ? validateDamageMultiplier(defendedDamageMultiplier)
      : 1;
    const resolvedDamage = Math.round(baseDamage * multiplier);
    const damageApplied = target.health.applyDamage(resolvedDamage).appliedDamage;

    for (const statusEffect of statusEffects) {
      target.applyStatus(statusEffect);
    }

    this.resolvedTimelineIds.add(event.timelineId);
    return {
      applied: true,
      timelineId: event.timelineId,
      defended,
      damageApplied,
      statusEffectsApplied: statusEffects.length,
    };
  }

  private emptyResult(timelineId: string): EnemyImpactResult {
    return {
      applied: false,
      timelineId,
      defended: false,
      damageApplied: 0,
      statusEffectsApplied: 0,
    };
  }
}
