import { describe, expect, test } from "bun:test";
import { defineSkill } from "@typing-roguelike/shared";
import { ActionPointResource } from "../src/game/combat/action-point-resource";
import { CombatState } from "../src/game/combat/combat-state";
import { SkillCommandStarter } from "../src/game/combat/skill-command-starter";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";

const attackSkill = defineSkill({
  id: "skill.integration.slash",
  name: "Integration Slash",
  command: "베기",
  kind: "attack",
  category: "basic",
  apCost: 2,
  windupMs: 100,
  recoveryMs: 200,
  effects: [{ type: "damage", coefficient: 1 }],
  description: "Integration test attack.",
});

const createHarness = (initialAp: number) => {
  const input = new CommandInputBuffer(attackSkill.command);
  const actionPoints = new ActionPointResource({
    maxAp: 6,
    initialAp,
    regenerationPerSecond: 0,
  });
  const combat = new CombatState();
  const starter = new SkillCommandStarter({
    skills: [attackSkill],
    actionPoints,
    combat,
    actorId: "player",
    targetId: "enemy-1",
  });
  const results: ReturnType<SkillCommandStarter["tryStart"]>[] = [];
  const disconnect = starter.connect(input, (result) => results.push(result));

  return { input, actionPoints, combat, results, disconnect };
};

describe("combat input and skill integration", () => {
  test("valid command spends AP and reaches the impact event", () => {
    const { input, actionPoints, combat, results, disconnect } = createHarness(6);

    input.updateInput(attackSkill.command);

    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result?.started).toBe(true);
    if (!result?.started) throw new Error("Expected skill to start.");

    expect(actionPoints.snapshot.currentAp).toBe(4);
    expect(combat.advance(attackSkill.windupMs).events).toEqual([
      {
        type: "cast-completed",
        actionId: result.actionId,
        actorId: "player",
        targetId: "enemy-1",
        atMs: attackSkill.windupMs,
      },
    ]);
    expect(combat.advance(attackSkill.recoveryMs).events).toEqual([
      {
        type: "impact-resolved",
        actionId: result.actionId,
        actorId: "player",
        targetId: "enemy-1",
        atMs: attackSkill.windupMs + attackSkill.recoveryMs,
      },
    ]);

    disconnect();
  });

  test("insufficient AP prevents skill start and combat action creation", () => {
    const { input, actionPoints, combat, results, disconnect } = createHarness(1);

    input.updateInput(attackSkill.command);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      started: false,
      command: attackSkill.command,
      reason: "insufficient-ap",
    });
    expect(actionPoints.snapshot.currentAp).toBe(1);
    expect(combat.snapshot.actions).toHaveLength(0);

    disconnect();
  });

  test("incorrect input never starts a skill or creates an impact", () => {
    const { input, actionPoints, combat, results, disconnect } = createHarness(6);

    const snapshot = input.updateInput("틀림");

    expect(snapshot.status).toBe("incorrect");
    expect(results).toHaveLength(0);
    expect(actionPoints.snapshot.currentAp).toBe(6);
    expect(combat.snapshot.actions).toHaveLength(0);
    expect(combat.advance(1_000).events).toEqual([]);

    disconnect();
  });
});
