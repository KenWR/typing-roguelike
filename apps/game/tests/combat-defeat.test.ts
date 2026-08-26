import { describe, expect, test } from "bun:test";
import { createInitialRunState, type RunState } from "@typing-roguelike/shared";
import { CombatDefeatResolver } from "../src/game/combat/combat-defeat";
import { CombatState } from "../src/game/combat/combat-state";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";

const createInProgressRun = (): RunState => {
  const runState = createInitialRunState({ seed: 160 });
  return {
    ...runState,
    map: {
      ...runState.map,
      currentNodeId: "node-1",
      nodeStatuses: {
        "node-1": "in_progress" as const,
      },
    },
  };
};

describe("combat defeat resolver", () => {
  test("player death ends combat and routes to death settlement", () => {
    const combat = new CombatState();
    const enemyTimeline = new EnemyAttackTimeline();
    enemyTimeline.startAttack({
      timelineId: "enemy.attack.1",
      enemyId: "enemy-1",
      targetId: "player",
      attackId: "slam",
      attackName: "Slam",
      attackType: "attack",
      windupMs: 1000,
      recoveryMs: 500,
    });

    const resolver = new CombatDefeatResolver({
      runState: createInProgressRun(),
      playerHealth: { maxHp: 100 },
      combat,
      enemyTimeline,
    });

    const result = resolver.applyDamage(100);

    expect(result.accepted).toBe(true);
    expect(result.damage?.deathOccurred).toBe(true);
    expect(result.playerHealth.isDead).toBe(true);
    expect(combat.snapshot.status).toBe("defeat");
    expect(combat.snapshot.canAcceptInput).toBe(false);
    expect(enemyTimeline.snapshot.status).toBe("defeat");
    expect(result.route?.sceneKey).toBe("RunResultScene");
    expect(result.route?.payload.result).toBe("death");
    expect(result.route?.runState.status).toBe("dead");
  });

  test("nonlethal damage keeps combat active", () => {
    const combat = new CombatState();
    const enemyTimeline = new EnemyAttackTimeline();
    const resolver = new CombatDefeatResolver({
      runState: createInProgressRun(),
      playerHealth: { maxHp: 100 },
      combat,
      enemyTimeline,
    });

    const result = resolver.applyDamage(25);

    expect(result.accepted).toBe(true);
    expect(result.damage?.deathOccurred).toBe(false);
    expect(result.playerHealth.currentHp).toBe(75);
    expect(result.route).toBeNull();
    expect(combat.snapshot.status).toBe("active");
    expect(enemyTimeline.snapshot.status).toBe("active");
  });

  test("damage is rejected after defeat so death cannot be processed twice", () => {
    const resolver = new CombatDefeatResolver({
      runState: createInProgressRun(),
      playerHealth: { maxHp: 40 },
    });

    const first = resolver.applyDamage(40);
    const second = resolver.applyDamage(10);

    expect(first.accepted).toBe(true);
    expect(first.route?.applied).toBe(true);
    expect(second.accepted).toBe(false);
    expect(second.damage).toBeNull();
    expect(second.route).toBe(first.route);
    expect(resolver.currentRunState.status).toBe("dead");
  });

  test("enemy timeline stops advancing after player death", () => {
    const enemyTimeline = new EnemyAttackTimeline();
    enemyTimeline.startAttack({
      timelineId: "enemy.attack.1",
      enemyId: "enemy-1",
      targetId: "player",
      attackId: "slam",
      attackName: "Slam",
      attackType: "attack",
      windupMs: 1000,
      recoveryMs: 500,
    });
    const resolver = new CombatDefeatResolver({
      runState: createInProgressRun(),
      playerHealth: { maxHp: 10 },
      enemyTimeline,
    });

    resolver.applyDamage(10);
    const beforeAdvance = enemyTimeline.snapshot;
    const update = enemyTimeline.advance(5000);

    expect(update.events).toHaveLength(0);
    expect(update.snapshot).toEqual(beforeAdvance);
  });
});
