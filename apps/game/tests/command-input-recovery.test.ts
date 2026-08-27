import { describe, expect, test } from "bun:test";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";
import {
  CommandInputRecoveryController,
  updateCommandInputElement,
} from "../src/game/input/command-input-recovery";

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

  test("keeps incorrect input in the buffer until it is explicitly reset", () => {
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
      input: "방패돌",
      committedInput: "방패돌",
      status: "incorrect",
      matchedLength: 2,
    });
  });

  test("accepts the same command normally after an incorrect input", () => {
    const controller = new CommandInputRecoveryController(
      new CommandInputBuffer("휘두르기"),
    );

    expect(controller.updateInput("휘둘").outcome).toBe("incorrect");
    controller.reset();

    const recovered = controller.updateInput("휘두르기");
    expect(recovered).toMatchObject({
      outcome: "complete",
      mistakeCount: 1,
      failedSnapshot: null,
    });
    expect(recovered.snapshot.status).toBe("complete");
  });

  test("keeps the DOM input value after a mistake until it is reset", () => {
    const controller = new CommandInputRecoveryController(
      new CommandInputBuffer("휘두르기"),
    );
    const input = { value: "휘둘" };

    const failed = updateCommandInputElement(controller, input);
    expect(failed.outcome).toBe("incorrect");
    expect(input.value).toBe("휘둘");

    input.value = "";
    controller.reset();
    input.value = "휘두르기";
    expect(updateCommandInputElement(controller, input).outcome).toBe("complete");
  });

  test("does not clear the DOM input while an IME composition is active", () => {
    const controller = new CommandInputRecoveryController(
      new CommandInputBuffer("가속"),
    );
    const input = { value: "갓" };

    const composing = updateCommandInputElement(controller, input, {
      isComposing: true,
    });

    expect(composing.outcome).toBe("composing");
    expect(input.value).toBe("갓");
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
