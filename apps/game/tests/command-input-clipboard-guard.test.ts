import { describe, expect, test } from "bun:test";
import {
  installCommandInputClipboardGuard,
  isBlockedClipboardShortcut,
  isPasteInput,
} from "../src/game/input/command-input-clipboard-guard";

const dispatchCancelableEvent = (
  target: EventTarget,
  type: string,
  properties: Record<string, unknown> = {},
): Event => {
  const event = Object.assign(new Event(type, { cancelable: true }), properties);
  target.dispatchEvent(event);
  return event;
};

describe("command input clipboard guard", () => {
  test.each([
    { key: "c", ctrlKey: true, metaKey: false },
    { key: "V", ctrlKey: true, metaKey: false },
    { key: "x", ctrlKey: false, metaKey: true },
    { key: "C", ctrlKey: false, metaKey: true },
  ])("blocks the $key clipboard shortcut", (event) => {
    expect(isBlockedClipboardShortcut(event)).toBe(true);
  });

  test.each([
    { key: "v", ctrlKey: false, metaKey: false },
    { key: "a", ctrlKey: true, metaKey: false },
    { key: "Backspace", ctrlKey: false, metaKey: false },
    { key: "한", ctrlKey: false, metaKey: false },
  ])("allows the $key key input", (event) => {
    expect(isBlockedClipboardShortcut(event)).toBe(false);
  });

  test("blocks paste before it mutates the input", () => {
    expect(isPasteInput({ inputType: "insertFromPaste" })).toBe(true);
  });

  test.each(["insertText", "deleteContentBackward", "insertCompositionText"])(
    "allows the %s input operation",
    (inputType) => {
      expect(isPasteInput({ inputType })).toBe(false);
    },
  );

  test.each(["copy", "cut", "paste"])("prevents the %s browser event", (eventType) => {
    const input = new EventTarget() as HTMLInputElement;
    installCommandInputClipboardGuard(input);

    const event = dispatchCancelableEvent(input, eventType);

    expect(event.defaultPrevented).toBe(true);
  });

  test("prevents clipboard keyboard shortcuts", () => {
    const input = new EventTarget() as HTMLInputElement;
    installCommandInputClipboardGuard(input);

    const event = dispatchCancelableEvent(input, "keydown", {
      key: "v",
      ctrlKey: true,
      metaKey: false,
    });

    expect(event.defaultPrevented).toBe(true);
  });

  test("prevents insertFromPaste before input mutation", () => {
    const input = new EventTarget() as HTMLInputElement;
    installCommandInputClipboardGuard(input);

    const event = dispatchCancelableEvent(input, "beforeinput", {
      inputType: "insertFromPaste",
    });

    expect(event.defaultPrevented).toBe(true);
  });

  test("removes every guard listener during cleanup", () => {
    const input = new EventTarget() as HTMLInputElement;
    const cleanup = installCommandInputClipboardGuard(input);
    cleanup();

    const paste = dispatchCancelableEvent(input, "paste");
    const shortcut = dispatchCancelableEvent(input, "keydown", {
      key: "v",
      ctrlKey: true,
      metaKey: false,
    });

    expect(paste.defaultPrevented).toBe(false);
    expect(shortcut.defaultPrevented).toBe(false);
  });
});
