import { describe, expect, test } from "bun:test";
import { defineSkill, type GeneratedMapNode } from "@typing-roguelike/shared";
import { ActionPointResource } from "../src/game/combat/action-point-resource";
import { CombatState } from "../src/game/combat/combat-state";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { initializeCombatEncounter } from "../src/game/combat/encounter-initializer";
import { PlayerCombatRuntime } from "../src/game/combat/player-combat-runtime";
import { SkillCommandStarter } from "../src/game/combat/skill-command-starter";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";
import { RunSession } from "../src/game/run/run-session";

const node: GeneratedMapNode = {
  choice: 1,
  icon: "combat",
  iconType: "combat",
  key: "1-1",
  parentKey: "start",
  nextNodeKeys: ["2-1"],
  round: 1,
  type: "combat",
};

const setup = () => {
  const created = new RunSession().create({ seed: 42 });
  const runState = {
    ...created,
    map: {
      ...created.map,
      currentNodeId: node.key,
      nodeStatuses: { [node.key]: "in_progress" as const, "2-1": "locked" as const },
    },
  };
  const entry = initializeCombatEncounter(runState, node);
  if (!entry.ok) throw new Error("Expected combat encounter");
  const combat = new CombatState();
  const enemyTimeline = new EnemyAttackTimeline();
  const runtime = new PlayerCombatRuntime({
    combat,
    enemyTimeline,
    runState,
    initialization: entry.combat,
    nextNodeIds: node.nextNodeKeys,
  });
  return { combat, enemyTimeline, runtime, initialization: entry.combat };
};

const startEnemyAttack = (ctx: ReturnType<typeof setup>, id: string) => {
  const enemy = ctx.initialization.enemies[0]!;
  const action = enemy.actions.find((candidate) => candidate.kind === "attack") ?? enemy.actions[0]!;
  ctx.enemyTimeline.startAttack({
    timelineId: id,
    enemyId: enemy.instanceId,
    targetId: "player",
    attackId: action.id,
    attackName: action.name,
    attackType: "attack",
    windupMs: action.windupMs,
    recoveryMs: action.recoveryMs,
  });
  return action;
};

describe("combat scene runtime integration", () => {
  test("command input reaches player impact and updates enemy HP", () => {
    const ctx = setup();
    const skillConfig = ctx.initialization.player.skills.find(
      (candidate) => candidate.kind === "attack",
    );
    expect(skillConfig).toBeDefined();
    if (skillConfig === undefined) return;

    const skill = defineSkill(skillConfig);
    const input = new CommandInputBuffer(skill.command);
    const actionPoints = new ActionPointResource({
      initialAp: skill.apCost,
      maxAp: skill.apCost,
      regenerationPerSecond: 0,
    });
    const starter = new SkillCommandStarter({
      skills: [skill],
      actionPoints,
      combat: ctx.combat,
      actorId: "player",
      targetId: ctx.initialization.enemies[0]!.instanceId,
    });
    const results: ReturnType<SkillCommandStarter["tryStart"]>[] = [];
    const disconnect = starter.connect(input, (result) => {
      results.push(result);
      if (result.started) ctx.runtime.registerAction(result.actionId, result.skill);
    });

    const enemy = ctx.initialization.enemies[0]!;
    const beforeHp = ctx.runtime.enemyHp[enemy.instanceId]!;
    input.updateInput(skill.command);
    const startResult = results[0];
    expect(startResult?.started).toBe(true);
    if (!startResult?.started) {
      disconnect();
      return;
    }

    const update = ctx.runtime.advance(skill.windupMs + skill.recoveryMs);

    expect(update.combat.events).toContainEqual({
      type: "impact-resolved",
      actionId: startResult.actionId,
      actorId: "player",
      targetId: enemy.instanceId,
      atMs: skill.windupMs + skill.recoveryMs,
    });
    expect(ctx.runtime.enemyHp[enemy.instanceId]).toBeLessThan(beforeHp);
    disconnect();
  });

  test("enemy impact updates player HP and eventually routes defeat once", () => {
    const ctx = setup();
    const action = startEnemyAttack(ctx, "enemy:first");
    const before = ctx.runtime.playerHp;
    const first = ctx.runtime.advance(action.windupMs + action.recoveryMs);
    expect(first.playerHp).toBeLessThan(before);

    let route = first.route;
    for (let i = 0; i < 100 && ctx.runtime.playerHp > 0; i += 1) {
      route = ctx.runtime.advance(action.windupMs + action.recoveryMs).route;
    }

    expect(ctx.runtime.playerHp).toBe(0);
    expect(ctx.combat.snapshot.status).toBe("defeat");
    expect(ctx.enemyTimeline.snapshot.status).toBe("defeat");
    expect(route?.sceneKey).toBe("RunResultScene");

    const after = ctx.runtime.advance(10_000);
    expect(after.route).toBe(route);
    expect(after.combat.events).toEqual([]);
    expect(after.enemyTimeline.events).toEqual([]);
  });

  test("guard impact reduces enemy damage during its active window", () => {
    const guarded = setup();
    const guard = defineSkill({
      id: "skill.test-guard",
      name: "테스트 가드",
      command: "가드",
      kind: "defense",
      category: "guard",
      apCost: 1,
      windupMs: 100,
      recoveryMs: 100,
      effects: [{ type: "guard", damageMultiplier: 0.25, durationMs: 20_000 }],
      description: "test guard",
    });
    guarded.combat.startAction({
      id: "player:guard",
      actorId: "player",
      targetId: "player",
      windupMs: guard.windupMs,
      recoveryMs: guard.recoveryMs,
    });
    guarded.runtime.registerAction("player:guard", guard);
    guarded.runtime.advance(guard.windupMs + guard.recoveryMs);
    const guardedAction = startEnemyAttack(guarded, "enemy:guarded");
    const guardedHp = guarded.runtime.playerHp;
    const guardedUpdate = guarded.runtime.advance(guardedAction.windupMs + guardedAction.recoveryMs);
    const guardedDamage = guardedHp - guarded.runtime.playerHp;

    const plain = setup();
    const plainAction = startEnemyAttack(plain, "enemy:plain");
    const plainHp = plain.runtime.playerHp;
    plain.runtime.advance(plainAction.windupMs + plainAction.recoveryMs);
    const plainDamage = plainHp - plain.runtime.playerHp;

    expect(guardedDamage).toBeLessThan(plainDamage);
  });
});
