import { describe, expect, test } from "bun:test";
import { RunSession } from "../src/game/run/run-session";

describe("RunSession", () => {
  test("keeps exactly one active run", () => {
    const session = new RunSession();
    const first = session.create({ seed: 1 });

    expect(session.get()).toBe(first);
    expect(() => session.create({ seed: 2 })).toThrow("An active run already exists.");
  });

  test("updates the same session state across consumers", () => {
    const session = new RunSession();
    session.create({ seed: 3 });

    const updated = session.update((current) => ({
      ...current,
      runCurrency: current.runCurrency + 10,
    }));

    expect(updated.runCurrency).toBe(10);
    expect(session.require().runCurrency).toBe(10);
  });

  test("ends a run and rejects later updates", () => {
    const session = new RunSession();
    session.create({ seed: 4 });
    const ended = session.end("dead");

    expect(ended.status).toBe("dead");
    expect(() => session.update((current) => ({ ...current, runCurrency: 999 }))).toThrow(
      "Finished runs cannot be updated.",
    );
  });

  test("allows a new run after an ended run", () => {
    const session = new RunSession();
    session.create({ seed: 5 });
    session.end("abandoned");

    const next = session.create({ seed: 6 });
    expect(next.map.seed).toBe(6);
    expect(next.status).toBe("active");
  });

  test("can clear the session", () => {
    const session = new RunSession();
    session.create({ seed: 7 });
    session.clear();

    expect(session.get()).toBeNull();
    expect(() => session.require()).toThrow("No run session is active.");
  });
});
