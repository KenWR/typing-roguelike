const BLOCKED_SHORTCUT_KEYS = new Set(["c", "v", "x"]);

export const isBlockedClipboardShortcut = (event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey">): boolean => {
  return (event.ctrlKey || event.metaKey) && BLOCKED_SHORTCUT_KEYS.has(event.key.toLowerCase());
};

export const isPasteInput = (event: Pick<InputEvent, "inputType">): boolean => event.inputType === "insertFromPaste";

export const installCommandInputClipboardGuard = (input: HTMLInputElement): (() => void) => {
  const preventClipboardOperation = (event: Event): void => {
    event.preventDefault();
  };
  const preventClipboardShortcut = (event: KeyboardEvent): void => {
    if (isBlockedClipboardShortcut(event)) event.preventDefault();
  };
  const preventPasteInput = (event: InputEvent): void => {
    if (isPasteInput(event)) event.preventDefault();
  };

  input.addEventListener("copy", preventClipboardOperation);
  input.addEventListener("cut", preventClipboardOperation);
  input.addEventListener("paste", preventClipboardOperation);
  input.addEventListener("keydown", preventClipboardShortcut);
  input.addEventListener("beforeinput", preventPasteInput);

  return () => {
    input.removeEventListener("copy", preventClipboardOperation);
    input.removeEventListener("cut", preventClipboardOperation);
    input.removeEventListener("paste", preventClipboardOperation);
    input.removeEventListener("keydown", preventClipboardShortcut);
    input.removeEventListener("beforeinput", preventPasteInput);
  };
};
