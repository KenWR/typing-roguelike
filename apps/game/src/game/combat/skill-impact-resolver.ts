import type { SkillDefinition, SkillStatusEffect } from "@typing-roguelike/shared";
import type { CombatActionEvent } from "./combat-state";
import { calculateDamage } from "./damage-formula";
import { HealthState, type HealthSnapshot } from "./health-state";
import type { ShieldPool } from "./shield-pool";

export type ActiveStatusEffect = Readonly<{
  statusId: string;
  durationMs: number;
  stacks: number;
}>;

export type TimedStatusEffect = ActiveStatusEffect &
  Readonly<{
    remainingMs: number;
  }>;

export type SkillCombatantSnapshot = Readonly<{
  id: string;
  attackPower: number;
  defense: number;
  health: HealthSnapshot;
  statuses: readonly ActiveStatusEffect[];
}>;

export type SkillCombatantConfig = Readonly<{
  id: string;
  attackPower: number;
  defense: number;
  maxHp?: number;
  initialHp?: number;
}>;

type MutableStatusEffect = {
  statusId: string;
  durationMs: number;
  remainingMs: number;
  stacks: number;
};

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
  private readonly statuses: MutableStatusEffect[] = [];

  constructor(config: SkillCombatantConfig) {
    this.id = validateIdentifier("Combatant id", config.id);
    this.attackPower = validateNonNegative("Attack power", config.attackPower);
    this.baseDefense = validateNonNegative("Defense", config.defense);
    this.health = new HealthState({ maxHp: config.maxHp, initialHp: config.initialHp });
  }

  get defense(): number {
    return this.baseDefense;
  }

  get snapshot(): SkillCombatantSnapshot {
    return {
      id: this.id,
      attackPower: this.attackPower,
      defense: this.defense,
      health: this.health.snapshot,
      statuses: this.statuses.map(({ statusId, durationMs, stacks }) => ({
        statusId,
        durationMs,
        stacks,
      })),
    };
  }

  /** HUD 등 presentation 계층에서 원래 지속시간과 남은 시간을 함께 사용한다. */
  get timedStatuses(): readonly TimedStatusEffect[] {
    return this.statuses.map(({ statusId, durationMs, remainingMs, stacks }) => ({
      statusId,
      durationMs,
      remainingMs,
      stacks,
    }));
  }

  applyStatus(effect: SkillStatusEffect): void {
    this.statuses.push({
      statusId: effect.statusId,
      durationMs: effect.durationMs,
      remainingMs: effect.durationMs,
      stacks: effect.stacks ?? 1,
    });
  }

  /** 기존 상태만 경과시키며 0이 된 상태는 즉시 제거한다. */
  advanceStatuses(deltaMs: number): void {
    const delta = validateNonNegative("Status delta", deltaMs);
    for (let index = this.statuses.length - 1; index >= 0; index -= 1) {
      const status = this.statuses[index]!;
      status.remainingMs = Math.max(0, status.remainingMs - delta);
      if (status.remainingMs === 0) this.statuses.splice(index, 1);
    }
  }
}

export type ResolveSkillImpactInput = Readonly<{
  event: CombatActionEvent;
  skill: SkillDefinition;
  actor: SkillCombatantState;
  target: SkillCombatantState;
  /** 대상의 실드 풀. 넘기면 피해가 실드를 먼저 깎고 남은 만큼만 HP로 갑니다. */
  shields?: ShieldPool;
  /** Combo multiplier captured when the player command started. */
  damageMultiplier?: number;
}>;

export type SkillImpactResult = Readonly<{
  applied: boolean;
  actionId: string;
  damageApplied: number;
  shieldAbsorbedDamage: number;
  /** 이 피해로 완전히 소진된 대상 실드 id 목록 */
  brokenShieldIds: readonly string[];
  statusEffectsApplied: number;
}>;

export class SkillImpactResolver {
  private readonly resolvedActionIds = new Set<string>();

  resolve({ event, skill, actor, target, shields, damageMultiplier = 1 }: ResolveSkillImpactInput): SkillImpactResult {
    if (event.type !== "impact-resolved") {
      return this.emptyResult(event.actionId);
    }
    if (this.resolvedActionIds.has(event.actionId)) {
      return this.emptyResult(event.actionId);
    }
    if (event.actorId !== actor.id || event.targetId !== target.id) {
      throw new Error(`Skill impact participants do not match action ${event.actionId}.`);
    }
    if (!Number.isFinite(damageMultiplier) || damageMultiplier <= 0) {
      throw new RangeError("Skill damage multiplier must be positive and finite.");
    }

    let damageApplied = 0;
    let shieldAbsorbedDamage = 0;
    let statusEffectsApplied = 0;
    const brokenShieldIds: string[] = [];

    for (const effect of skill.effects) {
      switch (effect.type) {
        case "damage": {
          const baseDamage = calculateDamage({
            attackPower: actor.attackPower,
            damageCoefficient: effect.coefficient,
            defense: target.defense,
          });
          const damage = Math.max(1, Math.round(baseDamage * damageMultiplier));
          const absorb = shields?.absorb(target.id, damage, event.atMs);
          if (absorb !== undefined) {
            shieldAbsorbedDamage += absorb.absorbedDamage;
            brokenShieldIds.push(...absorb.brokenShieldIds);
          }
          const throughDamage = absorb === undefined ? damage : absorb.remainingDamage;
          damageApplied += target.health.applyDamage(throughDamage).appliedDamage;
          break;
        }
        // 실드는 커맨드를 완성하는 순간 부여되므로 임팩트 시점에서는 처리하지 않습니다.
        case "shield":
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
      shieldAbsorbedDamage,
      brokenShieldIds,
      statusEffectsApplied,
    };
  }

  private emptyResult(actionId: string): SkillImpactResult {
    return {
      applied: false,
      actionId,
      damageApplied: 0,
      shieldAbsorbedDamage: 0,
      brokenShieldIds: [],
      statusEffectsApplied: 0,
    };
  }
}
