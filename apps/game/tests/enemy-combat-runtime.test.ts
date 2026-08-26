import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";
import type { CombatEncounterInitialization } from "../src/game/combat/encounter-initializer";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { EnemyCombatRuntime } from "../src/game/combat/enemy-combat-runtime";

const createInitialization = (currentHp = 20): CombatEncounterInitialization => ({
  nodeId: "1-1",
  floor: 1,
  nodeType: "combat",
  encounterId: "test-encounter",
  enemies: [
    {
      instanceId: "test-enemy:1",
      enemyId: "test-enemy",
      name: "테스트 적",
      hp: 30,
      actions: [
        {
          id: "hit",
          kind: "attack",
          name: "공격",
          damage: 7,
          windupMs: 100,
          recoveryMs: 100,
          description: "테스트 공격",
          animation: { windup: "test:windup" },
        },
      ],
    },
  ],
  player: {
    currentHp,
    maxHp: 20,
    equipmentIds: [],
    skills: [],
  },
  rewardPolicy: "standard",
});

const createRuntime = (currentHp = 20) => {
  const baseRun = createInitialRunState({ seed: 42 });
  const runState = {
    ...baseRun,
    character: {
      ...baseRun.character,
      currentHp,
      maxHp: 20,
    },
  };
  const combat = new CombatState();
  const timeline = new EnemyAttackTimeline();
  const runtime = new EnemyCombatRuntime({
    combat,
    enemyTimeline: timeline,
    runState,
    initialization: createInitialization(currentHp),
    random: () => 0,
  });
  runtime.start();
  return { runtime, combat, timeline };
};

describe("EnemyCombatRuntime", () => {
  test("applies enemy impact damage to player HP and RunState", () => {
    const { runtime } = createRuntime();

    const update = runtime.advance(200);

    expect(update.playerHp).toBeLessThan(20);
    expect(update.runState.character.currentHp).toBe(update.playerHp);
  });

  test("starts the next enemy attack after a completed attack while combat is active", () => {
    const { runtime } = createRuntime();

    const update = runtime.advance(200);

    expect(update.timeline.attacks).toHaveLength(2);
    expect(update.timeline.attacks[1]).toMatchObject({
      enemyId: "test-enemy:1",
      phase: "windup",
    });
  });

  test("routes to defeat and stops the enemy timeline when player dies", () => {
    const { runtime, combat, timeline } = createRuntime(1);

    const update = runtime.advance(200);

    expect(update.playerHp).toBe(0);
    expect(update.route).not.toBeNull();
    expect(update.runState.status).toBe("dead");
    expect(combat.snapshot.status).toBe("defeat");
    expect(timeline.snapshot.status).toBe("defeat");
  });

  test("does not schedule or apply more attacks after defeat", () => {
    const { runtime } = createRuntime(1);
    const defeated = runtime.advance(200);
    const attackCount = defeated.timeline.attacks.length;

    const after = runtime.advance(10_000);

    expect(after.playerHp).toBe(0);
    expect(after.timeline.attacks).toHaveLength(attackCount);
    expect(after.route).toBe(defeated.route);
  });
});
