import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import { RunSession } from "../src/game/run/run-session";
import { SettlementCompletionController } from "../src/game/settlement/settlement-completion";

describe("settlement completion", () => {
  test("keeps the settlement run until confirmation", () => {
    const session = new RunSession();
    const run = session.create({ seed: 1 });
    session.end("dead");
    const controller = new SettlementCompletionController(run, session);

    expect(controller.snapshot.confirmed).toBe(false);
    expect(controller.snapshot.runState).toBe(run);
    expect(session.get()).not.toBeNull();
  });

  test("confirmation clears temporary run state and returns to lobby once", () => {
    const session = new RunSession();
    const run = session.create({ seed: 2 });
    session.end("cleared");
    const controller = new SettlementCompletionController(run, session);

    const first = controller.confirm();
    expect(first.applied).toBe(true);
    expect(first.sceneKey).toBe("LobbyScene");
    expect(session.get()).toBeNull();

    const second = controller.confirm();
    expect(second.applied).toBe(false);
    expect(second.sceneKey).toBe("LobbyScene");
  });

  test("a new run can start after settlement confirmation", () => {
    const session = new RunSession();
    const run = session.create({ seed: 3 });
    session.end("dead");
    new SettlementCompletionController(run, session).confirm();

    const next = session.create({ seed: 4 });
    expect(next.status).toBe("active");
    expect(next.map.seed).toBe(4);
  });
});
