import type { SkillStatusEffect } from "@typing-roguelike/shared";
import { calculateDamage } from "./damage-formula";
import type { EnemyAttackEvent } from "./enemy-attack-timeline";
import type { ShieldPool } from "./shield-pool";
import { SkillCombatantState } from "./skill-impact-resolver";

export type ResolveEnemyImpactInput = Readonly<{
  event: EnemyAttackEvent;
  damage: number;
  target: SkillCombatantState;
  /** 대상의 실드 풀. 남은 실드가 피해를 먼저 흡수합니다. */
  shields?: ShieldPool;
  statusEffects?: readonly SkillStatusEffect[];
}>;

export type EnemyImpactResult = Readonly<{
  applied: boolean;
  timelineId: string;
  /** 실드가 피해의 일부라도 흡수했는지 여부 */
  defended: boolean;
  /** 실드만으로 피해를 전부 받아냈는지 여부 */
  fullyAbsorbed: boolean;
  shieldAbsorbedDamage: number;
  brokenShieldIds: readonly string[];
  damageApplied: number;
  statusEffectsApplied: number;
}>;

const validateNonNegative = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
  return value;
};

export class EnemyImpactResolver {
  private readonly resolvedTimelineIds = new Set<string>();

  resolve({
    event,
    damage,
    target,
    shields,
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
        ...this.emptyResult(event.timelineId),
        applied: true,
      };
    }

    const baseDamage = calculateDamage({
      attackPower: validateNonNegative("Enemy attack damage", damage),
      damageCoefficient: 1,
      defense: target.defense,
    });
    const absorb = shields?.absorb(target.id, baseDamage, event.atMs);
    const throughDamage = absorb === undefined ? baseDamage : absorb.remainingDamage;
    const damageApplied = target.health.applyDamage(throughDamage).appliedDamage;

    for (const statusEffect of statusEffects) {
      target.applyStatus(statusEffect);
    }

    this.resolvedTimelineIds.add(event.timelineId);
    return {
      applied: true,
      timelineId: event.timelineId,
      defended: absorb?.absorbed ?? false,
      fullyAbsorbed: absorb?.fullyAbsorbed ?? false,
      shieldAbsorbedDamage: absorb?.absorbedDamage ?? 0,
      brokenShieldIds: absorb?.brokenShieldIds ?? [],
      damageApplied,
      statusEffectsApplied: statusEffects.length,
    };
  }

  private emptyResult(timelineId: string): EnemyImpactResult {
    return {
      applied: false,
      timelineId,
      defended: false,
      fullyAbsorbed: false,
      shieldAbsorbedDamage: 0,
      brokenShieldIds: [],
      damageApplied: 0,
      statusEffectsApplied: 0,
    };
  }
}
