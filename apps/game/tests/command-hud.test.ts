import { describe, expect, test } from "bun:test";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";
import {
  createCommandHudState,
  getCommandHudCharacters,
  markSkillStarted,
  updateCommandHudState,
} from "../src/game/hud/command-hud";

describe("command HUD state", () => {
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
    const state = updateCommandHudState(
      createCommandHudState(buffer.snapshot),
      buffer.updateInput("방패돌"),
    );

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
    const state = updateCommandHudState(
      createCommandHudState(buffer.snapshot),
      completed,
    );

    const started = markSkillStarted(state);

    expect(started).toMatchObject({
      status: "complete",
      feedback: {
        type: "skill-started",
        command: "매직실드",
      },
    });
    expect(updateCommandHudState(started, completed).feedback).toEqual(
      started.feedback,
    );
  });
});
