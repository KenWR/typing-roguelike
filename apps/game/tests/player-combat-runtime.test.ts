import { describe, expect, test } from "bun:test";
import {
  defineSkill,
  type GeneratedMapNode,
} from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { initializeCombatEncounter } from "../src/game/combat/encounter-initializer";
import { PlayerCombatRuntime } from "../src/game/combat/player-combat-runtime";
import { RunSession } from "../src/game/run/run-session";

const firstCombatNode: GeneratedMapNode = {
  choice: 1,
  icon: "combat",
  iconType: "combat",
  key: "1-1",
  parentKey: "start",
  nextNodeKeys: ["2-1"],
  round: 1,
  type: "combat",
};

const createPlayableCombat = () => {
  const session = new RunSession();
  const created = session.create({ seed: 42 });
  const runState = {
    ...created,
    map: {
      ...created.map,
      currentNodeId: firstCombatNode.key,
      nodeStatuses: {
        [firstCombatNode.key]: "in_progress" as const,
        "2-1": "locked" as const,
      },
    },
  };
  const entry = initializeCombatEncounter(runState, firstCombatNode);
  expect(entry.ok).toBe(true);
  if (!entry.ok) throw new Error("Expected playable first combat.");

  const combat = new CombatState();
  const enemyTimeline = new EnemyAttackTimeline();
  const runtime = new PlayerCombatRuntime({
    combat,
    enemyTimeline,
    runState,
    initialization: entry.combat,
    nextNodeIds: firstCombatNode.nextNodeKeys,
  });

  return { combat, runtime, initialization: entry.combat, runState, enemyTimeline };
};

describe("PlayerCombatRuntime", () => {
  test("advances a started attack and applies real enemy HP damage", () => {
    const { combat, runtime, initialization } = createPlayableCombat();
    const skillConfig = initialization.player.skills.find((candidate) => candidate.kind === "attack");
    expect(skillConfig).toBeDefined();
    if (!skillConfig) return;
    const skill = defineSkill(skillConfig);

    const enemy = initialization.enemies[0]!;
    const beforeHp = runtime.enemyHp[enemy.instanceId]!;
    const actionId = "player:first-attack:1";
    combat.startAction({
      id: actionId,
      actorId: "player",
      targetId: enemy.instanceId,
      windupMs: skill.windupMs,
      recoveryMs: skill.recoveryMs,
    });
    runtime.registerAction(actionId, skill);

    runtime.advance(skill.windupMs + skill.recoveryMs);

    expect(runtime.enemyHp[enemy.instanceId]).toBeLessThan(beforeHp);
  });

  test("retargets a dead requested enemy to the next living enemy", () => {
    const { initialization, runState, enemyTimeline } = createPlayableCombat();
    const firstEnemy = initialization.enemies[0]!;
    const secondEnemy = {
      ...firstEnemy,
      instanceId: `${firstEnemy.instanceId}:second`,
    };
    const multiInitialization = {
      ...initialization,
      enemies: [firstEnemy, secondEnemy],
    };
    const combat = new CombatState();
    const runtime = new PlayerCombatRuntime({
      combat,
      enemyTimeline,
      runState,
      initialization: multiInitialization,
      nextNodeIds: firstCombatNode.nextNodeKeys,
      random: () => 0,
    });
    const skillConfig = initialization.player.skills.find((candidate) => candidate.kind === "attack")!;
    const skill = defineSkill(skillConfig);
    runtime.start();

    let sequence = 1;
    while ((runtime.enemyHp[firstEnemy.instanceId] ?? 0) > 0) {
      const actionId = `player:kill-first:${sequence++}`;
      combat.startAction({
        id: actionId,
        actorId: "player",
        targetId: firstEnemy.instanceId,
        windupMs: skill.windupMs,
        recoveryMs: skill.recoveryMs,
      });
      runtime.registerAction(actionId, skill);
      runtime.advance(skill.windupMs + skill.recoveryMs);
    }

    const secondHpBefore = runtime.enemyHp[secondEnemy.instanceId]!;
    const retargetActionId = "player:retarget:1";
    combat.startAction({
      id: retargetActionId,
      actorId: "player",
      targetId: firstEnemy.instanceId,
      windupMs: skill.windupMs,
      recoveryMs: skill.recoveryMs,
    });
    runtime.registerAction(retargetActionId, skill);
    runtime.advance(skill.windupMs + skill.recoveryMs);

    expect(runtime.enemyHp[firstEnemy.instanceId]).toBe(0);
    expect(runtime.enemyHp[secondEnemy.instanceId]).toBeLessThan(secondHpBefore);
    expect(enemyTimeline.snapshot.attacks).not.toContainEqual(
      expect.objectContaining({ enemyId: firstEnemy.instanceId }),
    );
    expect(combat.snapshot.status).toBe("active");
  });

  test("does not apply the same impact twice", () => {
    const { combat, runtime, initialization } = createPlayableCombat();
    const skillConfig = initialization.player.skills.find((candidate) => candidate.kind === "attack")!;
    const skill = defineSkill(skillConfig);
    const enemy = initialization.enemies[0]!;
    const actionId = "player:first-attack:dedupe";
    combat.startAction({
      id: actionId,
      actorId: "player",
      targetId: enemy.instanceId,
      windupMs: skill.windupMs,
      recoveryMs: skill.recoveryMs,
    });
    runtime.registerAction(actionId, skill);

    runtime.advance(skill.windupMs + skill.recoveryMs);
    const hpAfterImpact = runtime.enemyHp[enemy.instanceId];
    runtime.advance(5_000);

    expect(runtime.enemyHp[enemy.instanceId]).toBe(hpAfterImpact);
  });

  test("routes to reward flow after the final enemy dies", () => {
    const { combat, runtime, initialization } = createPlayableCombat();
    const skillConfig = initialization.player.skills.find((candidate) => candidate.kind === "attack")!;
    const skill = defineSkill(skillConfig);

    let route = null;
    let sequence = 1;
    for (const enemy of initialization.enemies) {
      while ((runtime.enemyHp[enemy.instanceId] ?? 0) > 0) {
        const actionId = `player:finish:${sequence++}`;
        combat.startAction({
          id: actionId,
          actorId: "player",
          targetId: enemy.instanceId,
          windupMs: skill.windupMs,
          recoveryMs: skill.recoveryMs,
        });
        runtime.registerAction(actionId, skill);
        route = runtime.advance(skill.windupMs + skill.recoveryMs).route;
      }
    }

    expect(combat.snapshot.status).toBe("victory");
    expect(combat.snapshot.canAcceptInput).toBe(false);
    expect(route).not.toBeNull();
    expect(route?.sceneKey === "RewardSelectionScene" || route?.sceneKey === "MapScene").toBe(true);
    expect(route?.runState.map.nodeStatuses[firstCombatNode.key]).toBe("cleared");
    expect(route?.runState.map.nodeStatuses["2-1"]).toBe("available");
  });
});
