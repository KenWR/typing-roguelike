import { describe, expect, test } from "bun:test";
import { defineSkill } from "@typing-roguelike/shared";
import { ActionPointResource } from "../src/game/combat/action-point-resource";
import { CombatState } from "../src/game/combat/combat-state";
import {
  SkillCommandStarter,
  type SkillStartResult,
} from "../src/game/combat/skill-command-starter";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";

const magicShield = defineSkill({
  id: "skill.magic-shield",
  name: "매직 실드",
  command: "매직실드",
  kind: "defense",
  category: "guard",
  apCost: 2,
  windupMs: 300,
  recoveryMs: 700,
  effects: [{ type: "guard", damageMultiplier: 0.5, durationMs: 1_000 }],
  description: "마법 보호막을 전개한다.",
});

const createFixture = (initialAp: number) => {
  const input = new CommandInputBuffer(magicShield.command);
  const actionPoints = new ActionPointResource({ maxAp: 6, initialAp });
  const combat = new CombatState();
  const starter = new SkillCommandStarter({
    skills: [magicShield],
    actionPoints,
    combat,
    actorId: "player",
    targetId: "player",
  });
  const results: SkillStartResult[] = [];
  starter.connect(input, (result) => results.push(result));

  return { input, actionPoints, combat, starter, results };
};

describe("SkillCommandStarter", () => {
  test("spends AP, starts the matching skill, and increments combo", () => {
    const { input, actionPoints, combat, results } = createFixture(6);

    input.updateInput("매직실드");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      started: true,
      skill: { id: "skill.magic-shield" },
      actionId: "player:skill.magic-shield:1",
      ap: { currentAp: 4 },
      combo: { count: 1, multiplier: 1, lastBreakReason: null },
      combat: {
        snapshot: {
          actions: [
            {
              id: "player:skill.magic-shield:1",
              phase: "windup",
            },
          ],
        },
      },
    });
    expect(actionPoints.snapshot.currentAp).toBe(4);
    expect(combat.snapshot.actions).toHaveLength(1);
  });

  test("does not increase combo when AP is insufficient", () => {
    const { input, actionPoints, combat, starter, results } = createFixture(1);

    input.updateInput("매직실드");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      started: false,
      command: "매직실드",
      reason: "insufficient-ap",
      ap: { currentAp: 1 },
      combo: { count: 0, multiplier: 1 },
    });
    expect(starter.comboSnapshot.count).toBe(0);
    expect(actionPoints.snapshot.currentAp).toBe(1);
    expect(combat.snapshot.actions).toEqual([]);
  });

  test("does not increase combo when combat cannot accept input", () => {
    const { input, actionPoints, combat, starter, results } = createFixture(6);
    combat.pause();

    input.updateInput("매직실드");

    expect(results[0]).toMatchObject({
      started: false,
      reason: "combat-unavailable",
      ap: { currentAp: 6 },
      combo: { count: 0, multiplier: 1 },
    });
    expect(starter.comboSnapshot.count).toBe(0);
    expect(actionPoints.snapshot.currentAp).toBe(6);
    expect(combat.snapshot.actions).toEqual([]);
  });

  test("tracks consecutive successful commands and breaks on incorrect input", () => {
    const { input, starter, results } = createFixture(6);

    input.updateInput("매직실드");
    expect(results[0]).toMatchObject({ combo: { count: 1 } });

    input.reset();
    input.updateInput("매직실드");
    expect(results[1]).toMatchObject({ combo: { count: 2 } });
    expect(starter.comboSnapshot.count).toBe(2);

    input.reset();
    input.updateInput("매직X");
    expect(starter.comboSnapshot).toEqual({
      count: 0,
      multiplier: 1,
      lastBreakReason: "incorrect-input",
    });
  });
});
