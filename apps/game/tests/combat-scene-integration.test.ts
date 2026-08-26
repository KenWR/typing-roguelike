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

const firstEnemy = <T extends { instanceId: string }>(enemies: readonly T[]): T => {
  const enemy = enemies[0];
  if (enemy === undefined) throw new Error("Expected combat test enemy.");
  return enemy;
};

const startEnemyAttack = (ctx: ReturnType<typeof setup>, id: string) => {
  const enemy = firstEnemy(ctx.initialization.enemies);
  const action = enemy.actions.find((candidate) => candidate.kind === "attack") ?? enemy.actions[0];
  if (action === undefined) throw new Error("Expected combat test action.");
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
    const skillConfig = ctx.initialization.player.skills.find((candidate) => candidate.kind === "attack");
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
      targetId: firstEnemy(ctx.initialization.enemies).instanceId,
    });
    const results: ReturnType<SkillCommandStarter["tryStart"]>[] = [];
    const disconnect = starter.connect(input, (result) => {
      results.push(result);
      if (result.started) ctx.runtime.registerAction(result.actionId, result.skill);
    });

    const enemy = firstEnemy(ctx.initialization.enemies);
    const beforeHp = ctx.runtime.enemyHp[enemy.instanceId];
    if (beforeHp === undefined) throw new Error("Expected combat test enemy HP.");
    input.updateInput(skill.command);
    input.submit();
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

  test("an area skill damages every living enemy in the encounter", () => {
    const created = new RunSession().create({ seed: 84 });
    const areaNode: GeneratedMapNode = {
      choice: 1,
      icon: "combat",
      iconType: "combat",
      key: "2-1",
      monsterId: "ink-slime",
      parentKey: "1-1",
      nextNodeKeys: ["3-1"],
      round: 2,
      type: "combat",
    };
    const runState = {
      ...created,
      map: {
        ...created.map,
        currentNodeId: areaNode.key,
        currentRound: areaNode.round,
        nodeStatuses: { [areaNode.key]: "in_progress" as const, "3-1": "locked" as const },
      },
    };
    const entry = initializeCombatEncounter(runState, areaNode);
    expect(entry.ok).toBe(true);
    if (!entry.ok) return;
    expect(entry.combat.enemies.length).toBeGreaterThan(1);

    const areaSkill = defineSkill({
      id: "skill.test-area",
      name: "지면 가르기",
      command: "지면가르기",
      kind: "attack",
      category: "special",
      apCost: 1,
      windupMs: 100,
      recoveryMs: 100,
      effects: [{ type: "damage", coefficient: 0.5 }],
      description: "모든 적에게 광역 피해를 줍니다.",
    });
    const initialization = {
      ...entry.combat,
      player: { ...entry.combat.player, skills: [areaSkill] },
    };
    const combat = new CombatState();
    const enemyTimeline = new EnemyAttackTimeline();
    const runtime = new PlayerCombatRuntime({ combat, enemyTimeline, runState, initialization });
    const input = new CommandInputBuffer(areaSkill.command);
    const starter = new SkillCommandStarter({
      skills: [areaSkill],
      actionPoints: new ActionPointResource({ initialAp: 6, maxAp: 6, regenerationPerSecond: 0 }),
      combat,
      actorId: "player",
      targetId: firstEnemy(initialization.enemies).instanceId,
    });
    starter.connect(input, (result) => {
      if (result.started) runtime.registerAction(result.actionId, result.skill);
    });

    input.updateInput(areaSkill.command);
    input.submit();
    runtime.advance(areaSkill.windupMs + areaSkill.recoveryMs);

    expect(Object.values(runtime.enemyHp)).toHaveLength(initialization.enemies.length);
    expect(Object.values(runtime.enemyHp).every((currentHp) => currentHp < 34)).toBe(true);
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

  const shieldSkill = defineSkill({
    id: "skill.test-shield",
    name: "테스트 실드",
    command: "실드",
    kind: "defense",
    category: "guard",
    apCost: 1,
    windupMs: 100,
    recoveryMs: 100,
    effects: [{ type: "shield", amount: 40, durationMs: 20_000 }],
    description: "test shield",
  });

  test("a shield absorbs enemy damage from the moment the command completes", () => {
    const shielded = setup();
    shielded.combat.startAction({
      id: "player:shield",
      actorId: "player",
      targetId: "player",
      windupMs: shieldSkill.windupMs,
      recoveryMs: shieldSkill.recoveryMs,
    });
    shielded.runtime.registerAction("player:shield", shieldSkill);
    expect(shielded.runtime.playerShield).toBe(40);

    const shieldedAction = startEnemyAttack(shielded, "enemy:shielded");
    const shieldedHp = shielded.runtime.playerHp;
    shielded.runtime.advance(shieldedAction.windupMs + shieldedAction.recoveryMs);
    const shieldedDamage = shieldedHp - shielded.runtime.playerHp;

    const plain = setup();
    const plainAction = startEnemyAttack(plain, "enemy:plain");
    const plainHp = plain.runtime.playerHp;
    plain.runtime.advance(plainAction.windupMs + plainAction.recoveryMs);
    const plainDamage = plainHp - plain.runtime.playerHp;

    expect(plainDamage).toBeGreaterThan(0);
    expect(shieldedDamage).toBe(0);
    expect(shielded.runtime.playerShield).toBe(40 - plainDamage);
  });

  test("the shield is already up before the skill would have finished its windup", () => {
    const ctx = setup();
    ctx.combat.startAction({
      id: "player:shield-early",
      actorId: "player",
      targetId: "player",
      windupMs: shieldSkill.windupMs,
      recoveryMs: shieldSkill.recoveryMs,
    });
    ctx.runtime.registerAction("player:shield-early", shieldSkill);

    ctx.runtime.advance(shieldSkill.windupMs - 1);

    expect(ctx.runtime.playerShield).toBe(40);
  });
});
