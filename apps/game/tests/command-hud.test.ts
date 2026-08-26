import { describe, expect, test } from "bun:test";
import { RING_CONFIGS } from "@typing-roguelike/shared";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";
import {
  createCommandHudState,
  createSkillCommandEffects,
  createTimedApCommandEffects,
  formatEffectRemainingTime,
  getCommandHudCharacters,
  getEffectDarknessRatio,
  markSkillStarted,
  formatAvailableSkillPreviews,
  updateCommandHudState,
} from "../src/game/hud/command-hud";

describe("command HUD state", () => {
  test("formats available skills with category, AP, and expected damage", () => {
    expect(
      formatAvailableSkillPreviews(
        [
          { name: "이중 베기", category: "special", apCost: 2 },
          { name: "방어", category: "guard", apCost: 1 },
          { name: "베기", category: "basic", apCost: 1 },
        ],
        (skill) => skill.apCost,
        (skill) => (skill.name === "베기" ? 9 : skill.category === "special" ? 17 : null),
      ),
    ).toBe(
      "TYPE // COMMAND // COST // DAMAGE\n기본기술 : 방어 : 1 : -\n기본기술 : 베기 : 1 : 9\n특수기술 : 이중 베기 : 2 : 17",
    );
  });

  test("shows ring effects as descriptive rows instead of duplicate commands", () => {
    const prefix = RING_CONFIGS.find((ring) => ring.position === "prefix" && ring.id === "ring_fury_prefix");
    expect(prefix).toBeDefined();
    if (prefix === undefined) return;
    const base = { name: "베기", command: "베기", category: "basic" as const, apCost: 1 };
    const prefixed = { ...base, command: `${prefix.commandAffix} ${base.command}`, apCost: 1 };

    const output = formatAvailableSkillPreviews([base, prefixed]);
    expect(output).toContain("기본기술 : 베기 : 1 : -");
    expect(output).toContain(`접두사 : ${prefix.commandAffix} 베기 : +30% 데미지`);
    expect(output).not.toContain(`${prefix.commandAffix} 베기 : 1 :`);
  });

  test("always keeps the current command visible and exposes matching progress", () => {
    const buffer = new CommandInputBuffer("매직실드");
    let state = createCommandHudState(buffer.snapshot);

    expect(state).toMatchObject({
      command: "매직실드",
      input: "",
      status: "idle",
      matchedLength: 0,
      feedback: null,
    });
    expect(getCommandHudCharacters(state)).toEqual([
      { value: "매", state: "pending" },
      { value: "직", state: "pending" },
      { value: "실", state: "pending" },
      { value: "드", state: "pending" },
    ]);

    state = updateCommandHudState(state, buffer.updateInput("매직"));

    expect(state).toMatchObject({
      command: "매직실드",
      input: "매직",
      status: "matching",
      matchedLength: 2,
    });
    expect(getCommandHudCharacters(state)).toEqual([
      { value: "매", state: "matched" },
      { value: "직", state: "matched" },
      { value: "실", state: "pending" },
      { value: "드", state: "pending" },
    ]);
  });

  test("marks the first incorrect command character immediately", () => {
    const buffer = new CommandInputBuffer("방패들기");
    const state = updateCommandHudState(createCommandHudState(buffer.snapshot), buffer.updateInput("방패돌"));

    expect(state).toMatchObject({
      command: "방패들기",
      status: "incorrect",
      matchedLength: 2,
    });
    expect(getCommandHudCharacters(state)).toEqual([
      { value: "방", state: "matched" },
      { value: "패", state: "matched" },
      { value: "들", state: "incorrect" },
      { value: "기", state: "pending" },
    ]);
  });

  test("records immediate skill-start feedback after a completed command", () => {
    const buffer = new CommandInputBuffer("매직실드");
    const completed = buffer.updateInput("매직실드");
    buffer.submit();
    const state = updateCommandHudState(createCommandHudState(buffer.snapshot), completed);

    const started = markSkillStarted(state);

    expect(started).toMatchObject({
      status: "complete",
      feedback: {
        type: "skill-started",
        command: "매직실드",
      },
    });
    expect(updateCommandHudState(started, completed).feedback).toEqual(started.feedback);
  });

  test("selects effect icons for guard, shield, and status command effects", () => {
    expect(
      createSkillCommandEffects({
        id: "skill.test",
        name: "수호 베기",
        command: "수호베기",
        description: "test",
        effects: [
          { type: "damage", coefficient: 1 },
          { type: "guard", damageMultiplier: 0.6, durationMs: 2_000 },
          { type: "shield", amount: 20, durationMs: 1_000 },
          { type: "status", statusId: "bleed", durationMs: 3_000, stacks: 2 },
        ],
      }),
    ).toEqual([
      {
        id: "skill.test:guard:1",
        name: "피해 감소",
        description: "수호 베기: 받는 피해 40% 감소 · 2초",
        durationMs: 2_000,
        remainingMs: null,
        textureKey: "effect:guard",
      },
      {
        id: "skill.test:shield:2",
        name: "실드",
        description: "수호 베기: 실드 20 · 1초",
        durationMs: 1_000,
        remainingMs: null,
        textureKey: "effect:shield",
      },
      {
        id: "skill.test:status:bleed:3",
        name: "bleed",
        description: "수호 베기: bleed 2중첩 · 3초",
        durationMs: 3_000,
        remainingMs: null,
        textureKey: "effect:bleed",
      },
    ]);
  });

  test("fills the dark overlay from bottom to top as timed effects expire", () => {
    const [effect] = createTimedApCommandEffects([
      { id: "temporary-ap-regeneration", amountPerSecond: 0.5, durationMs: 3_000, remainingMs: 750 },
    ]);
    expect(effect).toMatchObject({ name: "AP 재생 증가", textureKey: "effect:ap-regen-up" });
    if (effect === undefined) throw new Error("Expected AP effect preview");
    expect(getEffectDarknessRatio(effect)).toBe(0.75);
    expect(getEffectDarknessRatio({ durationMs: 3_000, remainingMs: 3_000 })).toBe(0);
    expect(getEffectDarknessRatio({ durationMs: 3_000, remainingMs: 0 })).toBe(1);
    expect(formatEffectRemainingTime(750)).toBe("남은 시간: 750ms");
    expect(formatEffectRemainingTime(1_250)).toBe("남은 시간: 1.3초");
  });
});
