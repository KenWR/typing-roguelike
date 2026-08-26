import { describe, expect, test } from "bun:test";
import { defineSkill } from "@typing-roguelike/shared";
import { ActionPointResource } from "../src/game/combat/action-point-resource";
import { CombatState } from "../src/game/combat/combat-state";
import { SkillCommandStarter } from "../src/game/combat/skill-command-starter";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";

const slash = defineSkill({
  id: "skill.repeat-slash",
  name: "연속 베기",
  command: "베기",
  kind: "attack",
  category: "basic",
  apCost: 2,
  windupMs: 100,
  recoveryMs: 100,
  effects: [{ type: "damage", coefficient: 1 }],
  description: "반복 입력 테스트용 공격",
});

describe("repeat command skill start", () => {
  test("starts two distinct actions when the same hidden-input command is typed twice", () => {
    const buffer = new CommandInputBuffer(slash.command);
    const combat = new CombatState();
    const actionPoints = new ActionPointResource({ initialAp: 6 });
    const starter = new SkillCommandStarter({
      skills: [slash],
      actionPoints,
      combat,
      actorId: "player",
      targetId: "enemy:1",
    });
    const actionIds: string[] = [];

    const disconnect = starter.connect(buffer, (result) => {
      if (result.started) actionIds.push(result.actionId);
    });

    buffer.updateInput("베기");
    buffer.updateInput("베기베");
    buffer.updateInput("베기베기");

    expect(actionIds).toHaveLength(2);
    expect(actionIds[0]).not.toBe(actionIds[1]);
    expect(combat.snapshot.actions).toHaveLength(2);
    expect(actionPoints.snapshot.currentAp).toBe(2);

    disconnect();
  });

  test("can retry the completed command after an AP failure", () => {
    const buffer = new CommandInputBuffer(slash.command);
    const combat = new CombatState();
    const actionPoints = new ActionPointResource({ initialAp: 0 });
    const starter = new SkillCommandStarter({
      skills: [slash],
      actionPoints,
      combat,
      actorId: "player",
      targetId: "enemy:1",
    });
    const results: string[] = [];

    starter.connect(buffer, (result) => {
      results.push(result.started ? "started" : result.reason);
    });

    buffer.updateInput("베기");
    actionPoints.advance(2_000);
    buffer.updateInput("베기베");
    buffer.updateInput("베기베기");

    expect(results).toEqual(["insufficient-ap", "started"]);
  });
});
