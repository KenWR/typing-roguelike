import { describe, expect, test } from "bun:test";
import { defineSkill } from "@typing-roguelike/shared";
import type { CombatActionEvent } from "../src/game/combat/combat-state";
import { ShieldPool } from "../src/game/combat/shield-pool";
import {
  SkillCombatantState,
  SkillImpactResolver,
} from "../src/game/combat/skill-impact-resolver";

const impactEvent = (actionId = "action.slash.1"): CombatActionEvent => ({
  type: "impact-resolved",
  actionId,
  actorId: "player",
  targetId: "enemy",
  atMs: 500,
});

const castEvent: CombatActionEvent = {
  type: "cast-completed",
  actionId: "action.slash.1",
  actorId: "player",
  targetId: "enemy",
  atMs: 200,
};

const createCombatants = () => ({
  actor: new SkillCombatantState({
    id: "player",
    attackPower: 100,
    defense: 10,
    maxHp: 100,
  }),
  target: new SkillCombatantState({
    id: "enemy",
    attackPower: 20,
    defense: 100,
    maxHp: 100,
  }),
});

describe("skill impact resolver", () => {
  test("does not apply effects before the impact event", () => {
    const resolver = new SkillImpactResolver();
    const { actor, target } = createCombatants();
    const skill = defineSkill({
      id: "skill.slash",
      name: "Slash",
      command: "베기",
      kind: "attack",
      category: "basic",
      apCost: 1,
      windupMs: 200,
      recoveryMs: 300,
      effects: [{ type: "damage", coefficient: 1 }],
      description: "Basic attack",
    });

    const result = resolver.resolve({ event: castEvent, skill, actor, target });

    expect(result.applied).toBe(false);
    expect(target.snapshot.health.currentHp).toBe(100);
  });

  test("uses the combat damage formula when a damage skill impacts", () => {
    const resolver = new SkillImpactResolver();
    const { actor, target } = createCombatants();
    const skill = defineSkill({
      id: "skill.slash",
      name: "Slash",
      command: "베기",
      kind: "attack",
      category: "basic",
      apCost: 1,
      windupMs: 200,
      recoveryMs: 300,
      effects: [{ type: "damage", coefficient: 1 }],
      description: "Basic attack",
    });

    const result = resolver.resolve({ event: impactEvent(), skill, actor, target });

    expect(result.damageApplied).toBe(50);
    expect(target.snapshot.health.currentHp).toBe(50);
  });

  test("applies the combo damage multiplier to impact damage", () => {
    const resolver = new SkillImpactResolver();
    const { actor, target } = createCombatants();
    const skill = defineSkill({
      id: "skill.combo-slash",
      name: "Combo Slash",
      command: "연속베기",
      kind: "attack",
      category: "basic",
      apCost: 1,
      windupMs: 200,
      recoveryMs: 300,
      effects: [{ type: "damage", coefficient: 1 }],
      description: "Combo attack",
    });

    const result = resolver.resolve({
      event: impactEvent("action.combo-slash"),
      skill,
      actor,
      target,
      damageMultiplier: 1.05,
    });

    expect(result.damageApplied).toBe(53);
    expect(target.snapshot.health.currentHp).toBe(47);
  });

  test("keeps shield effects out of impact resolution and applies status to the target", () => {
    const resolver = new SkillImpactResolver();
    const { actor, target } = createCombatants();
    const skill = defineSkill({
      id: "skill.guard-break",
      name: "Guard Break",
      command: "응수",
      kind: "utility",
      category: "special",
      apCost: 2,
      windupMs: 100,
      recoveryMs: 200,
      effects: [
        { type: "shield", amount: 20, durationMs: 800 },
        { type: "status", statusId: "weakened", durationMs: 1200, stacks: 2 },
      ],
      description: "Shield and weaken",
    });

    const result = resolver.resolve({ event: impactEvent("action.guard.1"), skill, actor, target });

    expect(result.statusEffectsApplied).toBe(1);
    expect(result.shieldAbsorbedDamage).toBe(0);
    expect(target.snapshot.statuses).toEqual([
      { statusId: "weakened", durationMs: 1200, stacks: 2 },
    ]);
  });

  test("spends the target shield before its health and reports the broken shield", () => {
    const resolver = new SkillImpactResolver();
    const { actor, target } = createCombatants();
    const shields = new ShieldPool();
    shields.grant({
      id: "enemy:windup:shield",
      ownerId: "enemy",
      amount: 30,
      durationMs: 1_000,
      atMs: 0,
    });
    const skill = defineSkill({
      id: "skill.slash",
      name: "Slash",
      command: "베기",
      kind: "attack",
      category: "basic",
      apCost: 1,
      windupMs: 200,
      recoveryMs: 300,
      effects: [{ type: "damage", coefficient: 1 }],
      description: "Basic attack",
    });

    const result = resolver.resolve({
      event: impactEvent("action.slash.shielded"),
      skill,
      actor,
      target,
      shields,
    });

    expect(result.shieldAbsorbedDamage).toBe(30);
    expect(result.damageApplied).toBe(20);
    expect(result.brokenShieldIds).toEqual(["enemy:windup:shield"]);
    expect(target.snapshot.health.currentHp).toBe(80);
  });

  test("does not apply the same action impact twice", () => {
    const resolver = new SkillImpactResolver();
    const { actor, target } = createCombatants();
    const skill = defineSkill({
      id: "skill.slash",
      name: "Slash",
      command: "베기",
      kind: "attack",
      category: "basic",
      apCost: 1,
      windupMs: 200,
      recoveryMs: 300,
      effects: [{ type: "damage", coefficient: 1 }],
      description: "Basic attack",
    });
    const event = impactEvent();

    expect(resolver.resolve({ event, skill, actor, target }).applied).toBe(true);
    expect(resolver.resolve({ event, skill, actor, target }).applied).toBe(false);
    expect(target.snapshot.health.currentHp).toBe(50);
  });
});
