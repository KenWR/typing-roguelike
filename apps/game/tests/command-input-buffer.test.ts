import { describe, expect, test } from "bun:test";
import { CommandInputBuffer } from "../src/game/input/command-input-buffer";

describe("CommandInputBuffer", () => {
  test("accumulates input and reports matching progress", () => {
    const buffer = new CommandInputBuffer("매직실드");

    expect(buffer.appendInput("매")).toMatchObject({
      input: "매",
      committedInput: "매",
      status: "matching",
      matchedLength: 1,
    });
    expect(buffer.appendInput("직")).toMatchObject({
      input: "매직",
      committedInput: "매직",
      status: "matching",
      matchedLength: 2,
    });
  });

  test("reports the first incorrect position immediately", () => {
    const buffer = new CommandInputBuffer("방패들기");

    expect(buffer.updateInput("방패돌")).toMatchObject({
      status: "incorrect",
      matchedLength: 2,
    });
  });

  test("keeps a completed command visible until the input is explicitly reset", () => {
    const buffer = new CommandInputBuffer("베기");
    const completed: string[] = [];
    buffer.onCompleted(({ input }) => completed.push(input));

    expect(buffer.updateInput("베기")).toMatchObject({
      input: "베기",
      committedInput: "베기",
      status: "complete",
      matchedLength: 2,
    });
    expect(buffer.snapshot).toMatchObject({
      input: "베기",
      committedInput: "베기",
      status: "complete",
      matchedLength: 2,
    });
    expect(completed).toEqual(["베기"]);

    expect(buffer.reset()).toMatchObject({
      input: "",
      committedInput: "",
      status: "idle",
      matchedLength: 0,
    });
  });

  test("submits the current cycle before clearing it", () => {
    const buffer = new CommandInputBuffer("test");
    const submitted: string[] = [];
    buffer.onSubmitted(({ snapshot }) => submitted.push(`${snapshot.input}:${snapshot.status}`));

    buffer.updateInput("testX");
    expect(buffer.submit()).toMatchObject({ input: "", status: "idle" });
    expect(submitted).toEqual(["testX:incorrect"]);
  });

  test("emits completion once until the buffer is reset", () => {
    const buffer = new CommandInputBuffer("휘두르기");
    const completed: string[] = [];
    buffer.onCompleted(({ command }) => completed.push(command));

    expect(buffer.updateInput("휘두르기").status).toBe("complete");
    buffer.updateInput("휘두르기");
    expect(completed).toEqual(["휘두르기"]);

    buffer.reset();
    buffer.updateInput("휘두르기");
    expect(completed).toEqual(["휘두르기", "휘두르기"]);
  });

  test("starts a fresh cycle when input continues after a completed command", () => {
    const buffer = new CommandInputBuffer("베기");
    const completed: string[] = [];
    buffer.onCompleted(({ input }) => completed.push(input));

    expect(buffer.updateInput("베기").status).toBe("complete");
    expect(buffer.updateInput("베기베")).toMatchObject({
      input: "베",
      committedInput: "베",
      status: "matching",
    });

    expect(completed).toEqual(["베기"]);
  });

  test("requires an explicit reset before typing the same command again", () => {
    const buffer = new CommandInputBuffer("찌르기");
    let completionCount = 0;
    buffer.onCompleted(() => {
      completionCount += 1;
    });

    buffer.updateInput("찌르기");
    expect(buffer.reset().status).toBe("idle");
    expect(buffer.updateInput("찌르기").status).toBe("complete");
    expect(completionCount).toBe(2);
  });

  test("does not commit or complete during IME composition", () => {
    const buffer = new CommandInputBuffer("가속");
    let completionCount = 0;
    buffer.onCompleted(() => {
      completionCount += 1;
    });

    expect(buffer.updateInput("가속", { isComposing: true })).toMatchObject({
      input: "가속",
      committedInput: "",
      status: "composing",
    });
    expect(completionCount).toBe(0);

    expect(buffer.updateInput("가속")).toMatchObject({
      committedInput: "가속",
      status: "complete",
    });
    expect(completionCount).toBe(1);
  });

  test("matches canonically equivalent Unicode input", () => {
    const buffer = new CommandInputBuffer("é");

    expect(buffer.updateInput("e\u0301").status).toBe("complete");
  });

  test("rejects an empty command", () => {
    expect(() => new CommandInputBuffer("")).toThrow(RangeError);
  });
});
