import { describe, expect, test } from "bun:test";
import { ShieldPool } from "../src/game/combat/shield-pool";
import type { EnemyAttackEvent } from "../src/game/combat/enemy-attack-timeline";
import { EnemyImpactResolver } from "../src/game/combat/enemy-impact-resolver";
import { SkillCombatantState } from "../src/game/combat/skill-impact-resolver";

const impactEvent = (timelineId = "enemy.attack.1"): EnemyAttackEvent => ({
  type: "impact-resolved",
  timelineId,
  enemyId: "slime",
  targetId: "player",
  attackId: "slam",
  attackType: "attack",
  atMs: 600,
});

const defenseImpactEvent: EnemyAttackEvent = {
  ...impactEvent("enemy.defense.1"),
  attackId: "guard",
  attackType: "defense",
};

const castEvent: EnemyAttackEvent = {
  ...impactEvent(),
  type: "cast-completed",
  atMs: 300,
};

const createPlayer = () =>
  new SkillCombatantState({
    id: "player",
    attackPower: 10,
    defense: 100,
    maxHp: 100,
  });

describe("enemy impact resolver", () => {
  test("does not apply damage before recovery completes", () => {
    const player = createPlayer();
    const result = new EnemyImpactResolver().resolve({
      event: castEvent,
      damage: 100,
      target: player,
      shields: new ShieldPool(),
    });

    expect(result.applied).toBe(false);
    expect(player.snapshot.health.currentHp).toBe(100);
  });

  test("applies damage once when the impact event arrives", () => {
    const player = createPlayer();
    const resolver = new EnemyImpactResolver();
    const event = impactEvent();
    const input = {
      event,
      damage: 100,
      target: player,
      shields: new ShieldPool(),
    } as const;

    expect(resolver.resolve(input)).toMatchObject({
      applied: true,
      defended: false,
      damageApplied: 50,
    });
    expect(resolver.resolve(input).applied).toBe(false);
    expect(player.snapshot.health.currentHp).toBe(50);
  });

  test("does not damage the player when an enemy defense completes", () => {
    const player = createPlayer();

    const result = new EnemyImpactResolver().resolve({
      event: defenseImpactEvent,
      damage: 0,
      target: player,
      shields: new ShieldPool(),
    });

    expect(result).toMatchObject({ applied: true, damageApplied: 0 });
    expect(player.snapshot.health.currentHp).toBe(100);
  });

  test("spends the shield that is still active at the exact impact time", () => {
    const player = createPlayer();
    const shields = new ShieldPool();
    shields.grant({
      id: "shield.1",
      ownerId: "player",
      amount: 30,
      durationMs: 200,
      atMs: 500,
    });

    const result = new EnemyImpactResolver().resolve({
      event: impactEvent(),
      damage: 100,
      target: player,
      shields,
    });

    expect(result.defended).toBe(true);
    expect(result.fullyAbsorbed).toBe(false);
    expect(result.shieldAbsorbedDamage).toBe(30);
    expect(result.damageApplied).toBe(20);
    expect(player.snapshot.health.currentHp).toBe(80);
  });

  test("takes no health damage while the shield covers the whole hit", () => {
    const player = createPlayer();
    const shields = new ShieldPool();
    shields.grant({
      id: "shield.big",
      ownerId: "player",
      amount: 80,
      durationMs: 400,
      atMs: 400,
    });

    const result = new EnemyImpactResolver().resolve({
      event: impactEvent(),
      damage: 100,
      target: player,
      shields,
    });

    expect(result.fullyAbsorbed).toBe(true);
    expect(result.damageApplied).toBe(0);
    expect(player.snapshot.health.currentHp).toBe(100);
    expect(shields.totalAmount("player", 600)).toBe(30);
  });

  test("ignores a shield that expired exactly when the hit lands", () => {
    const player = createPlayer();
    const shields = new ShieldPool();
    shields.grant({
      id: "shield.expired",
      ownerId: "player",
      amount: 80,
      durationMs: 200,
      atMs: 400,
    });

    const result = new EnemyImpactResolver().resolve({
      event: impactEvent(),
      damage: 100,
      target: player,
      shields,
    });

    expect(result.defended).toBe(false);
    expect(result.damageApplied).toBe(50);
  });

  test("applies configured status effects only at impact", () => {
    const player = createPlayer();
    const resolver = new EnemyImpactResolver();
    const statusEffects = [
      { type: "status" as const, statusId: "bleeding", durationMs: 1500, stacks: 2 },
    ];

    resolver.resolve({
      event: castEvent,
      damage: 20,
      target: player,
      shields: new ShieldPool(),
      statusEffects,
    });
    expect(player.snapshot.statuses).toEqual([]);

    const result = resolver.resolve({
      event: impactEvent(),
      damage: 20,
      target: player,
      shields: new ShieldPool(),
      statusEffects,
    });

    expect(result.statusEffectsApplied).toBe(1);
    expect(player.snapshot.statuses).toEqual([
      { statusId: "bleeding", durationMs: 1500, stacks: 2 },
    ]);
  });
});
