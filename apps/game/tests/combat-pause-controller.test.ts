import { describe, expect, test } from "bun:test";
import { CombatPauseController } from "../src/game/combat/combat-pause-controller";

const resource = () => {
  let paused = false;
  let pauseCalls = 0;
  let resumeCalls = 0;
  return {
    api: {
      pause: () => { paused = true; pauseCalls += 1; },
      resume: () => { paused = false; resumeCalls += 1; },
    },
    snapshot: () => ({ paused, pauseCalls, resumeCalls }),
  };
};

describe("CombatPauseController", () => {
  test("pauses all resources once and resumes after all reasons clear", () => {
    const first = resource();
    const second = resource();
    const controller = new CombatPauseController([first.api, second.api]);

    controller.pause("blur");
    controller.pause("visibility");
    expect(first.snapshot()).toEqual({ paused: true, pauseCalls: 1, resumeCalls: 0 });

    controller.resume("blur");
    expect(controller.paused).toBe(true);
    expect(first.snapshot().resumeCalls).toBe(0);

    controller.resume("visibility");
    expect(controller.paused).toBe(false);
    expect(first.snapshot().resumeCalls).toBe(1);
    expect(second.snapshot().resumeCalls).toBe(1);
  });

  test("manual pause toggles explicitly", () => {
    const target = resource();
    const controller = new CombatPauseController([target.api]);
    controller.toggleManualPause();
    expect(controller.paused).toBe(true);
    controller.toggleManualPause();
    expect(controller.paused).toBe(false);
  });

  test("dispose removes browser listeners", () => {
    const documentListeners = new Map<string, () => void>();
    const windowListeners = new Map<string, (event?: { key?: string }) => void>();
    const documentSource = {
      hidden: false,
      addEventListener: (type: "visibilitychange", listener: () => void) => documentListeners.set(type, listener),
      removeEventListener: (type: "visibilitychange") => { documentListeners.delete(type); },
    };
    const windowSource = {
      addEventListener: (type: "blur" | "focus" | "keydown", listener: (event?: { key?: string }) => void) => windowListeners.set(type, listener),
      removeEventListener: (type: "blur" | "focus" | "keydown") => { windowListeners.delete(type); },
    };
    const controller = new CombatPauseController([]);
    controller.bind(documentSource, windowSource);
    expect(documentListeners.size).toBe(1);
    expect(windowListeners.size).toBe(3);
    controller.dispose();
    expect(documentListeners.size).toBe(0);
    expect(windowListeners.size).toBe(0);
  });
});
