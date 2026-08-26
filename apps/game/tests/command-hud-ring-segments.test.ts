import { describe, expect, test } from "bun:test";
import {
  formatAvailableCommands,
  formatSegmentedAvailableCommands,
  formatSegmentedCommand,
  splitRingCommand,
} from "../src/game/hud/command-hud";

describe("command HUD ring segments", () => {
  test("keeps the legacy plain command formatter unchanged", () => {
    expect(formatAvailableCommands(["베기", "찌르기"])).toBe("베기, 찌르기");
  });

  test("separates prefix, base command, and suffix using the ring registry", () => {
    expect(splitRingCommand("신속한 베기 연속으로")).toEqual({
      prefix: "신속한",
      baseCommand: "베기",
      suffix: "연속으로",
    });
    expect(formatSegmentedCommand("신속한 베기 연속으로")).toBe(
      "접두사: 신속한  |  명령어: 베기  |  접미사: 연속으로",
    );
  });

  test("keeps a base-only command clearly identified as the command segment", () => {
    expect(splitRingCommand("베기")).toEqual({ baseCommand: "베기" });
    expect(formatSegmentedCommand("베기")).toBe("명령어: 베기");
  });

  test("renders each available command as its own segmented row", () => {
    expect(formatSegmentedAvailableCommands([
      "베기",
      "신속한 베기",
      "베기 연속으로",
      "신속한 베기 연속으로",
    ])).toBe([
      "명령어: 베기",
      "접두사: 신속한  |  명령어: 베기",
      "명령어: 베기  |  접미사: 연속으로",
      "접두사: 신속한  |  명령어: 베기  |  접미사: 연속으로",
    ].join("\n"));
  });
});
