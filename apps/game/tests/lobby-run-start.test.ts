import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import { LobbyRunStarter } from "../src/game/scenes/lobby-run-start";

describe("LobbyRunStarter", () => {
  test("initializes a new run once with the generated seed", () => {
    let calls = 0;
    const starter = new LobbyRunStarter(
      (seed) => {
        calls += 1;
        return createInitialRunState({ seed });
      },
      () => 4242,
    );

    const runState = starter.start();

    expect(runState?.map.seed).toBe(4242);
    expect(runState?.status).toBe("active");
    expect(calls).toBe(1);
    expect(starter.isStarting).toBe(false);
  });

  test("can start another run after the first run finishes", () => {
    let calls = 0;
    const starter = new LobbyRunStarter(
      (seed) => {
        calls += 1;
        return createInitialRunState({ seed });
      },
      () => 7,
    );

    expect(starter.start()).not.toBeNull();
    expect(starter.start()).not.toBeNull();
    expect(calls).toBe(2);
  });

  test("releases the lock when initialization fails", () => {
    let attempts = 0;
    const starter = new LobbyRunStarter(
      () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("failed to initialize");
        }
        return createInitialRunState({ seed: 9 });
      },
      () => 9,
    );

    expect(() => starter.start()).toThrow("failed to initialize");
    expect(starter.isStarting).toBe(false);
    expect(starter.start()?.map.seed).toBe(9);
    expect(attempts).toBe(2);
  });
});
