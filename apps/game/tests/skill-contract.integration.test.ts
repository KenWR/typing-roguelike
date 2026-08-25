import { describe, expect, test } from "bun:test";
import {
  createSkillActionDefinition,
  defineSkill,
} from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";

describe("skill contract combat integration", () => {
  test("drives the existing combat lifecycle with shared skill timing", () => {
    const skill = defineSkill({
      id: "skill.slash",
      name: "Slash",
      command: "휘두르기",
      kind: "attack",
      category: "basic",
      apCost: 1,
      windupMs: 200,
      recoveryMs: 350,
      effects: [{ type: "damage", coefficient: 1.25 }],
      description: "A basic sword attack.",
    });
    const combat = new CombatState();

    combat.startAction(
      createSkillActionDefinition(skill, {
        actionId: "action.slash.1",
        actorId: "player",
        targetId: "slime",
      }),
    );

    expect(combat.advance(200).events).toEqual([
      {
        type: "cast-completed",
        actionId: "action.slash.1",
        actorId: "player",
        targetId: "slime",
        atMs: 200,
      },
    ]);
    expect(combat.advance(350).events).toEqual([
      {
        type: "impact-resolved",
        actionId: "action.slash.1",
        actorId: "player",
        targetId: "slime",
        atMs: 550,
      },
    ]);
  });
});
