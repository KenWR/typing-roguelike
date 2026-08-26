import { describe, expect, test } from "bun:test";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";
import { CommandInputRecoveryController } from "../src/game/input/command-input-recovery";

describe("CommandInputRecoveryController", () => {
  test("keeps matching input without counting a mistake", () => {
    const controller = new CommandInputRecoveryController(
      new CommandInputBuffer("매직실드"),
    );

    const result = controller.updateInput("매직");

    expect(result).toMatchObject({
      outcome: "matching",
      mistakeCount: 0,
      failedSnapshot: null,
    });
    expect(result.snapshot).toMatchObject({
      input: "매직",
      committedInput: "매직",
      status: "matching",
    });
  });

  test("distinguishes incorrect input and resets the active buffer", () => {
    const controller = new CommandInputRecoveryController(
      new CommandInputBuffer("방패들기"),
    );

    const result = controller.updateInput("방패돌");

    expect(result.outcome).toBe("incorrect");
    expect(result.mistakeCount).toBe(1);
    expect(result.failedSnapshot).toMatchObject({
      input: "방패돌",
      status: "incorrect",
      matchedLength: 2,
    });
    expect(result.snapshot).toMatchObject({
      input: "",
      committedInput: "",
      status: "idle",
      matchedLength: 0,
    });
  });

  test("accepts the same command normally after an incorrect input", () => {
    const controller = new CommandInputRecoveryController(
      new CommandInputBuffer("휘두르기"),
    );

    expect(controller.updateInput("휘둘").outcome).toBe("incorrect");

    const recovered = controller.updateInput("휘두르기");
    expect(recovered).toMatchObject({
      outcome: "complete",
      mistakeCount: 1,
      failedSnapshot: null,
    });
    expect(recovered.snapshot.status).toBe("complete");
  });

  test("does not treat IME composition as an incorrect input", () => {
    const controller = new CommandInputRecoveryController(
      new CommandInputBuffer("가속"),
    );

    const composing = controller.updateInput("갓", { isComposing: true });

    expect(composing).toMatchObject({
      outcome: "composing",
      mistakeCount: 0,
      failedSnapshot: null,
    });
    expect(composing.snapshot.input).toBe("갓");
  });

  test("tracks mistakes independently from changing commands", () => {
    const controller = new CommandInputRecoveryController(
      new CommandInputBuffer("베기"),
    );

    controller.updateInput("배");
    const changed = controller.setCommand("막기");

    expect(changed).toMatchObject({
      outcome: "idle",
      mistakeCount: 1,
      failedSnapshot: null,
    });
    expect(changed.snapshot.command).toBe("막기");

    controller.resetMistakes();
    expect(controller.snapshot.mistakeCount).toBe(0);
  });
});
