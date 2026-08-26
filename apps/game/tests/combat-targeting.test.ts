import { describe, expect, test } from "bun:test";
import {
  CombatTargetingController,
  resolveActiveTargetId,
  resolveNextTargetId,
  type TargetingKeyboardEvent,
  type TargetingKeyboardSource,
} from "../src/game/combat/combat-targeting";

const createKeyboardSource = () => {
  const listeners = new Set<(event: TargetingKeyboardEvent) => void>();
  const source: TargetingKeyboardSource = {
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };

  return {
    source,
    get listenerCount(): number {
      return listeners.size;
    },
    press(key: string, shiftKey = false): { prevented: boolean } {
      let prevented = false;
      const event: TargetingKeyboardEvent = {
        key,
        shiftKey,
        preventDefault: () => {
          prevented = true;
        },
      };
      for (const listener of listeners) listener(event);
      return { prevented };
    },
  };
};

describe("combat targeting", () => {
  test("cycles forward and wraps back to the first enemy", () => {
    const candidates = [
      { id: "a", isAlive: true },
      { id: "b", isAlive: true },
      { id: "c", isAlive: true },
    ];

    expect(resolveNextTargetId(candidates, undefined)).toBe("a");
    expect(resolveNextTargetId(candidates, "a")).toBe("b");
    expect(resolveNextTargetId(candidates, "b")).toBe("c");
    expect(resolveNextTargetId(candidates, "c")).toBe("a");
  });

  test("skips fallen enemies while cycling", () => {
    const candidates = [
      { id: "a", isAlive: true },
      { id: "b", isAlive: false },
      { id: "c", isAlive: true },
    ];

    expect(resolveNextTargetId(candidates, "a")).toBe("c");
    expect(resolveNextTargetId(candidates, "c")).toBe("a");
    expect(resolveNextTargetId(candidates, "a", -1)).toBe("c");
  });

  test("returns nothing when every enemy is down", () => {
    const candidates = [
      { id: "a", isAlive: false },
      { id: "b", isAlive: false },
    ];

    expect(resolveNextTargetId(candidates, "a")).toBeUndefined();
    expect(resolveActiveTargetId(candidates, "a")).toBeUndefined();
    expect(resolveNextTargetId([], undefined)).toBeUndefined();
  });

  test("keeps a living target and moves off a fallen one", () => {
    const candidates = [
      { id: "a", isAlive: false },
      { id: "b", isAlive: true },
    ];

    expect(resolveActiveTargetId(candidates, "b")).toBe("b");
    expect(resolveActiveTargetId(candidates, "a")).toBe("b");
  });

  test("Tab cycles the target and blocks the browser's own focus move", () => {
    const keyboard = createKeyboardSource();
    const alive = new Set(["a", "b", "c"]);
    const changes: (string | undefined)[] = [];
    const controller = new CombatTargetingController({
      enemyIds: ["a", "b", "c"],
      isAlive: (enemyId) => alive.has(enemyId),
      onTargetChanged: (targetId) => changes.push(targetId),
    });
    controller.bind(keyboard.source);

    expect(controller.targetId).toBe("a");
    expect(keyboard.press("Tab").prevented).toBe(true);
    expect(controller.targetId).toBe("b");

    keyboard.press("Tab");
    expect(controller.targetId).toBe("c");

    // 한 바퀴를 돌면 처음 지정했던 적으로 돌아옵니다.
    keyboard.press("Tab");
    expect(controller.targetId).toBe("a");
    expect(changes).toEqual(["b", "c", "a"]);

    keyboard.press("Tab", true);
    expect(controller.targetId).toBe("c");
  });

  test("ignores other keys and stops listening once disposed", () => {
    const keyboard = createKeyboardSource();
    const controller = new CombatTargetingController({
      enemyIds: ["a", "b"],
      isAlive: () => true,
    });
    controller.bind(keyboard.source);

    expect(keyboard.press("Enter").prevented).toBe(false);
    expect(controller.targetId).toBe("a");

    controller.dispose();
    expect(keyboard.listenerCount).toBe(0);
    keyboard.press("Tab");
    expect(controller.targetId).toBe("a");
  });

  test("refresh moves off a target that has fallen", () => {
    const alive = new Set(["a", "b"]);
    const controller = new CombatTargetingController({
      enemyIds: ["a", "b"],
      isAlive: (enemyId) => alive.has(enemyId),
    });

    expect(controller.refresh()).toBe("a");
    alive.delete("a");
    expect(controller.refresh()).toBe("b");
    alive.delete("b");
    expect(controller.refresh()).toBeUndefined();
  });
});
