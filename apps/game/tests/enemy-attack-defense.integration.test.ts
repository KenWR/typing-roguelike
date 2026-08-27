import { describe, expect, test } from "bun:test";
import { ShieldPool } from "../src/game/combat/shield-pool";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { EnemyImpactResolver } from "../src/game/combat/enemy-impact-resolver";
import { SkillCombatantState } from "../src/game/combat/skill-impact-resolver";

const createPlayer = () =>
  new SkillCombatantState({
    id: "player",
    attackPower: 10,
    defense: 0,
    maxHp: 100,
  });

const startAttack = (
  timeline: EnemyAttackTimeline,
  overrides: Partial<Parameters<EnemyAttackTimeline["startAttack"]>[0]> = {},
) =>
  timeline.startAttack({
    timelineId: "enemy-attack-1",
    enemyId: "enemy-1",
    targetId: "player",
    attackId: "slam",
    attackName: "Slam",
    attackType: "attack",
    windupMs: 300,
    recoveryMs: 200,
    ...overrides,
  });

describe("enemy attack and defense integration", () => {
  test("waits through windup and recovery before applying damage once", () => {
    const timeline = new EnemyAttackTimeline();
    const resolver = new EnemyImpactResolver();
    const shields = new ShieldPool();
    const player = createPlayer();
    startAttack(timeline);

    const castUpdate = timeline.advance(300);
    expect(castUpdate.events).toMatchObject([
      {
        type: "cast-completed",
        timelineId: "enemy-attack-1",
        atMs: 300,
      },
    ]);

    const castEvent = castUpdate.events[0];
    if (!castEvent) throw new Error("Expected cast completion event.");
    expect(
      resolver.resolve({
        event: castEvent,
        damage: 40,
        target: player,
        shields,
      }).applied,
    ).toBe(false);
    expect(player.snapshot.health.currentHp).toBe(100);

    const impactUpdate = timeline.advance(200);
    expect(impactUpdate.events).toMatchObject([
      {
        type: "impact-resolved",
        timelineId: "enemy-attack-1",
        atMs: 500,
      },
    ]);

    const impactEvent = impactUpdate.events[0];
    if (!impactEvent) throw new Error("Expected impact event.");
    const firstImpact = resolver.resolve({
      event: impactEvent,
      damage: 40,
      target: player,
      shields,
    });
    const hpAfterImpact = player.snapshot.health.currentHp;

    expect(firstImpact.applied).toBe(true);
    expect(firstImpact.damageApplied).toBeGreaterThan(0);
    expect(hpAfterImpact).toBeLessThan(100);
    expect(
      resolver.resolve({
        event: impactEvent,
        damage: 40,
        target: player,
        shields,
      }).applied,
    ).toBe(false);
    expect(player.snapshot.health.currentHp).toBe(hpAfterImpact);
  });

  test("reduces damage when the impact lands while a shield is still up", () => {
    const undefendedTimeline = new EnemyAttackTimeline();
    const undefendedPlayer = createPlayer();
    startAttack(undefendedTimeline, { timelineId: "undefended" });
    const undefendedEvent = undefendedTimeline
      .advance(500)
      .events.find(({ type }) => type === "impact-resolved");
    if (!undefendedEvent) throw new Error("Expected undefended impact event.");
    const undefended = new EnemyImpactResolver().resolve({
      event: undefendedEvent,
      damage: 40,
      target: undefendedPlayer,
      shields: new ShieldPool(),
    });

    const defendedTimeline = new EnemyAttackTimeline();
    const defendedPlayer = createPlayer();
    const shields = new ShieldPool();
    shields.grant({
      id: "shield-1",
      ownerId: "player",
      amount: 15,
      durationMs: 100,
      atMs: 450,
    });
    startAttack(defendedTimeline, { timelineId: "defended" });
    const defendedEvent = defendedTimeline
      .advance(500)
      .events.find(({ type }) => type === "impact-resolved");
    if (!defendedEvent) throw new Error("Expected defended impact event.");
    const defended = new EnemyImpactResolver().resolve({
      event: defendedEvent,
      damage: 40,
      target: defendedPlayer,
      shields,
    });

    expect(defended.defended).toBe(true);
    expect(defended.damageApplied).toBeLessThan(undefended.damageApplied);
    expect(defendedPlayer.snapshot.health.currentHp).toBeGreaterThan(
      undefendedPlayer.snapshot.health.currentHp,
    );
  });

  test("keeps overlapping attack events ordered by their actual timing", () => {
    const timeline = new EnemyAttackTimeline();
    startAttack(timeline, {
      timelineId: "slow",
      enemyId: "enemy-slow",
      attackId: "heavy-slam",
      windupMs: 400,
      recoveryMs: 200,
    });
    startAttack(timeline, {
      timelineId: "fast",
      enemyId: "enemy-fast",
      attackId: "quick-jab",
      windupMs: 200,
      recoveryMs: 100,
    });

    const update = timeline.advance(700);

    expect(
      update.events.map(({ type, timelineId, atMs }) => ({
        type,
        timelineId,
        atMs,
      })),
    ).toEqual([
      { type: "cast-completed", timelineId: "fast", atMs: 200 },
      { type: "impact-resolved", timelineId: "fast", atMs: 300 },
      { type: "cast-completed", timelineId: "slow", atMs: 400 },
      { type: "impact-resolved", timelineId: "slow", atMs: 600 },
    ]);
  });
});
