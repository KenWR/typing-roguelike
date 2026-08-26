import { describe, expect, test } from "bun:test";
import { DefenseWindowTracker } from "../src/game/combat/defense-window";
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
      defenseWindows: new DefenseWindowTracker(),
      defendedDamageMultiplier: 0.4,
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
      defenseWindows: new DefenseWindowTracker(),
      defendedDamageMultiplier: 0.4,
    } as const;

    expect(resolver.resolve(input)).toMatchObject({
      applied: true,
      defended: false,
      damageApplied: 50,
    });
    expect(resolver.resolve(input).applied).toBe(false);
    expect(player.snapshot.health.currentHp).toBe(50);
  });

  test("checks the defense window at the exact impact time and reduces damage", () => {
    const player = createPlayer();
    const defenseWindows = new DefenseWindowTracker();
    defenseWindows.openWindow("guard.1", "player", 500, 200);

    const result = new EnemyImpactResolver().resolve({
      event: impactEvent(),
      damage: 100,
      target: player,
      defenseWindows,
      defendedDamageMultiplier: 0.4,
    });

    expect(result.defended).toBe(true);
    expect(result.damageApplied).toBe(20);
    expect(player.snapshot.health.currentHp).toBe(80);
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
      defenseWindows: new DefenseWindowTracker(),
      defendedDamageMultiplier: 0.4,
      statusEffects,
    });
    expect(player.snapshot.statuses).toEqual([]);

    const result = resolver.resolve({
      event: impactEvent(),
      damage: 20,
      target: player,
      defenseWindows: new DefenseWindowTracker(),
      defendedDamageMultiplier: 0.4,
      statusEffects,
    });

    expect(result.statusEffectsApplied).toBe(1);
    expect(player.snapshot.statuses).toEqual([
      { statusId: "bleeding", durationMs: 1500, stacks: 2 },
    ]);
  });
});
