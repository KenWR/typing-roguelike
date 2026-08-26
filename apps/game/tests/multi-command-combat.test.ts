import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS, defineSkill } from "@typing-roguelike/shared";
import { ActionPointResource } from "../src/game/combat/action-point-resource";
import { CombatState } from "../src/game/combat/combat-state";
import { SkillCommandStarter } from "../src/game/combat/skill-command-starter";
import { formatAvailableCommands } from "../src/game/hud/command-hud";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";

const COMMANDS = ["휘두르기", "내려찍기", "지면 가르기"] as const;

describe("multi-command combat input", () => {
  test("selects the active command from the typed prefix and completes second and third commands", () => {
    const buffer = new CommandInputBuffer(COMMANDS);
    const completed: string[] = [];
    buffer.onCompleted(({ command }) => completed.push(command));

    expect(buffer.updateInput("내")).toMatchObject({
      command: "내려찍기",
      status: "matching",
      matchedLength: 1,
    });
    expect(buffer.updateInput("내려찍기")).toMatchObject({
      command: "내려찍기",
      status: "complete",
    });

    buffer.reset();
    expect(buffer.updateInput("지면 ")).toMatchObject({
      command: "지면 가르기",
      status: "matching",
    });
    expect(buffer.updateInput("지면 가르기")).toMatchObject({
      command: "지면 가르기",
      status: "complete",
    });

    expect(completed).toEqual(["내려찍기", "지면 가르기"]);
  });

  test("allows the same non-first command to be executed repeatedly", () => {
    const buffer = new CommandInputBuffer(COMMANDS);
    const completed: string[] = [];
    buffer.onCompleted(({ command }) => completed.push(command));

    expect(buffer.updateInput("내려찍기").status).toBe("complete");
    buffer.reset();
    expect(buffer.updateInput("내")).toMatchObject({
      command: "내려찍기",
      input: "내",
      status: "matching",
    });
    expect(buffer.updateInput("내려찍기").status).toBe("complete");

    expect(completed).toEqual(["내려찍기", "내려찍기"]);
  });

  test("recovers from an incorrect input and can select another command", () => {
    const buffer = new CommandInputBuffer(COMMANDS);

    expect(buffer.updateInput("내려찎")).toMatchObject({
      command: "내려찍기",
      status: "incorrect",
    });
    buffer.reset();
    expect(buffer.updateInput("지면 가르기")).toMatchObject({
      command: "지면 가르기",
      status: "complete",
    });
  });

  test("does not commit a selected command during Korean IME composition", () => {
    const buffer = new CommandInputBuffer(["베기", "내려찍기"]);
    let completions = 0;
    buffer.onCompleted(() => {
      completions += 1;
    });

    expect(buffer.updateInput("내려찍기", { isComposing: true })).toMatchObject({
      command: "내려찍기",
      committedInput: "",
      status: "composing",
    });
    expect(completions).toBe(0);

    expect(buffer.updateInput("내려찍기")).toMatchObject({
      command: "내려찍기",
      committedInput: "내려찍기",
      status: "complete",
    });
    expect(completions).toBe(1);
  });

  test("matches NFC-equivalent input and selects the exact normalized command", () => {
    const buffer = new CommandInputBuffer(["가속", "é"]);

    expect(buffer.updateInput("e\u0301")).toMatchObject({
      command: "é",
      status: "complete",
    });
  });

  test("rejects an empty command list and NFC-equivalent duplicates", () => {
    expect(() => new CommandInputBuffer([])).toThrow(RangeError);
    expect(() => new CommandInputBuffer(["é", "e\u0301"])).toThrow(
      "Duplicate command",
    );
  });

  test("formats all HUD commands with comma-space separators", () => {
    expect(formatAvailableCommands(COMMANDS)).toBe(
      "휘두르기, 내려찍기, 지면 가르기",
    );
  });
});

describe("equipment combat command coverage", () => {
  test("recounts equipment commands and verifies every command maps to its exact skill action", () => {
    const equipmentCount = EQUIPMENT_CONFIGS.length;
    const skillCount = EQUIPMENT_CONFIGS.reduce(
      (total, equipment) => total + equipment.skills.length,
      0,
    );

    console.info(
      `[equipment-command-audit] equipment=${equipmentCount} skills=${skillCount}`,
    );
    expect(equipmentCount).toBe(78);
    expect(skillCount).toBe(197);

    for (const equipment of EQUIPMENT_CONFIGS) {
      const commands = equipment.skills.map((skill) => skill.command);
      const displayed = formatAvailableCommands(commands);
      expect(displayed).toBe(commands.join(", "));
      for (const command of commands) {
        expect(displayed.includes(command)).toBe(true);
      }

      const definitions = equipment.skills.map((skill) => defineSkill(skill));
      for (const expectedSkill of definitions) {
        const maxAp = Math.max(6, expectedSkill.apCost);
        const actionPoints = new ActionPointResource({
          maxAp,
          initialAp: maxAp,
          regenerationPerSecond: 0,
        });
        const combat = new CombatState();
        const starter = new SkillCommandStarter({
          skills: definitions,
          actionPoints,
          combat,
          actorId: "player",
          targetId: "enemy-1",
        });
        const buffer = new CommandInputBuffer(commands);
        const results: ReturnType<SkillCommandStarter["tryStart"]>[] = [];
        const disconnect = starter.connect(buffer, (result) => results.push(result));

        const snapshot = buffer.updateInput(expectedSkill.command);
        expect(snapshot.command).toBe(expectedSkill.command);
        expect(snapshot.status).toBe("complete");
        expect(results).toHaveLength(1);

        const result = results[0];
        expect(result?.started).toBe(true);
        if (!result?.started) {
          disconnect();
          throw new Error(
            `Expected ${equipment.id}/${expectedSkill.id} to start.`,
          );
        }

        expect(result.skill.id).toBe(expectedSkill.id);
        expect(result.skill.command).toBe(expectedSkill.command);
        expect(actionPoints.snapshot.currentAp).toBe(maxAp - expectedSkill.apCost);
        expect(combat.snapshot.actions).toHaveLength(1);
        expect(combat.snapshot.actions[0]?.id).toBe(result.actionId);
        disconnect();
      }
    }
  });

  test("has no NFC command duplicates or full-prefix collisions within any equipment", () => {
    const collisions: string[] = [];

    for (const equipment of EQUIPMENT_CONFIGS) {
      const commands = equipment.skills.map((skill) => skill.command.normalize("NFC"));
      const uniqueCommands = new Set(commands);
      if (uniqueCommands.size !== commands.length) {
        collisions.push(`${equipment.id}: duplicate command`);
      }

      for (let leftIndex = 0; leftIndex < commands.length; leftIndex += 1) {
        for (let rightIndex = 0; rightIndex < commands.length; rightIndex += 1) {
          if (leftIndex === rightIndex) continue;
          const left = commands[leftIndex]!;
          const right = commands[rightIndex]!;
          if (right.startsWith(left)) {
            collisions.push(`${equipment.id}: ${left} -> ${right}`);
          }
        }
      }
    }

    console.info(
      `[equipment-command-audit] prefix-collisions=${collisions.length}`,
    );
    expect(collisions).toEqual([]);
  });
});
