import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import { ActionPointResource } from "../src/game/combat/action-point-resource";
import { CombatState } from "../src/game/combat/combat-state";
import type { CombatEncounterInitialization } from "../src/game/combat/encounter-initializer";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { EnemyCombatRuntime } from "../src/game/combat/enemy-combat-runtime";

const initialization: CombatEncounterInitialization = {
  nodeId: "1-1",
  floor: 1,
  nodeType: "combat",
  encounterId: "ap-drain-test",
  enemies: [
    {
      instanceId: "enemy:1",
      enemyId: "enemy",
      name: "AP 적",
      hp: 20,
      actions: [
        {
          id: "ap-hit",
          kind: "special",
          name: "행동력 압박",
          damage: 1,
          apDelta: -2,
          windupMs: 1,
          recoveryMs: 0,
          description: "플레이어 AP를 2 감소시킵니다.",
          animation: { windup: "test:windup" },
        },
      ],
    },
  ],
  player: {
    currentHp: 20,
    maxHp: 20,
    equipmentIds: [],
    skills: [],
  },
  rewardPolicy: "standard",
};

describe("EnemyCombatRuntime AP effects", () => {
  test("enemy AP drain adjusts the shared action point resource on impact", () => {
    const actionPoints = new ActionPointResource({ initialAp: 5 });
    const combat = new CombatState();
    const timeline = new EnemyAttackTimeline();
    const runtime = new EnemyCombatRuntime({
      combat,
      enemyTimeline: timeline,
      actionPoints,
      runState: createInitialRunState({ seed: 1 }),
      initialization,
      random: () => 0,
    });

    runtime.start();
    const update = runtime.advance(1);

    expect(update.playerAp).toBe(3);
    expect(actionPoints.snapshot.currentAp).toBe(3);
  });
});
