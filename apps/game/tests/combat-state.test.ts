import { describe, expect, test } from "bun:test";
import { CombatState } from "../src/game/combat/combat-state";

const createAction = () => ({
  id: "player-slash-1",
  actorId: "player",
  targetId: "slime",
  windupMs: 300,
  recoveryMs: 500,
});

describe("CombatState", () => {
  test("starts active and accepts combat input", () => {
    const combat = new CombatState();

    expect(combat.snapshot).toMatchObject({
      status: "active",
      elapsedMs: 0,
      canAcceptInput: true,
      actions: [],
    });
  });

  test("tracks windup, cast completion, recovery, and impact", () => {
    const combat = new CombatState();
    combat.startAction(createAction());

    expect(combat.advance(150)).toMatchObject({
      events: [],
      snapshot: {
        elapsedMs: 150,
        actions: [
          {
            phase: "windup",
            phaseElapsedMs: 150,
            phaseDurationMs: 300,
            phaseProgress: 0.5,
            castCompleted: false,
            impactResolved: false,
          },
        ],
      },
    });

    expect(combat.advance(150)).toMatchObject({
      events: [
        {
          type: "cast-completed",
          actionId: "player-slash-1",
          atMs: 300,
        },
      ],
      snapshot: {
        elapsedMs: 300,
        actions: [
          {
            phase: "recovery",
            phaseElapsedMs: 0,
            castCompleted: true,
            impactResolved: false,
          },
        ],
      },
    });

    expect(combat.advance(500)).toMatchObject({
      events: [
        {
          type: "impact-resolved",
          actionId: "player-slash-1",
          atMs: 800,
        },
      ],
      snapshot: {
        elapsedMs: 800,
        actions: [
          {
            phase: "resolved",
            phaseProgress: 1,
            impactResolved: true,
          },
        ],
      },
    });
  });

  test("emits every crossed milestone when a frame spans multiple phases", () => {
    const combat = new CombatState();
    combat.startAction(createAction());

    const update = combat.advance(1_000);

    expect(update.events).toEqual([
      {
        type: "cast-completed",
        actionId: "player-slash-1",
        actorId: "player",
        targetId: "slime",
        atMs: 300,
      },
      {
        type: "impact-resolved",
        actionId: "player-slash-1",
        actorId: "player",
        targetId: "slime",
        atMs: 800,
      },
    ]);
    expect(update.snapshot.actions[0]).toMatchObject({
      phase: "resolved",
      impactResolved: true,
    });
  });

  test("freezes combat time and actions while paused", () => {
    const combat = new CombatState();
    combat.startAction(createAction());
    combat.advance(100);

    expect(combat.pause()).toMatchObject({
      status: "paused",
      elapsedMs: 100,
      canAcceptInput: false,
    });
    expect(combat.advance(1_000)).toMatchObject({
      events: [],
      snapshot: {
        elapsedMs: 100,
        actions: [{ phase: "windup", phaseElapsedMs: 100 }],
      },
    });

    combat.resume();
    expect(combat.advance(200).events).toMatchObject([
      { type: "cast-completed", atMs: 300 },
    ]);
  });

  test("supports instantaneous actions without duplicating events", () => {
    const combat = new CombatState();

    const started = combat.startAction({
      id: "instant-guard",
      actorId: "player",
      targetId: "player",
      windupMs: 0,
      recoveryMs: 0,
    });

    expect(started.events.map(({ type }) => type)).toEqual([
      "cast-completed",
      "impact-resolved",
    ]);
    expect(started.snapshot.actions[0]).toMatchObject({
      phase: "resolved",
      impactResolved: true,
    });
    expect(combat.advance(100).events).toEqual([]);
  });

  test("stops accepting input and advancing after combat finishes", () => {
    const combat = new CombatState();
    combat.startAction(createAction());
    combat.advance(100);

    expect(combat.finish("victory")).toMatchObject({
      status: "victory",
      canAcceptInput: false,
    });
    expect(combat.advance(1_000)).toMatchObject({
      events: [],
      snapshot: {
        status: "victory",
        elapsedMs: 100,
        actions: [{ phase: "windup", phaseElapsedMs: 100 }],
      },
    });
    expect(() => combat.startAction(createAction())).toThrow(
      "Cannot start an action while combat is victory.",
    );
  });

  test("rejects duplicate action ids and invalid timing values", () => {
    const combat = new CombatState();
    combat.startAction(createAction());

    expect(() => combat.startAction(createAction())).toThrow(
      "Action id already exists",
    );
    expect(() => combat.advance(-1)).toThrow(RangeError);
    expect(() =>
      new CombatState().startAction({
        ...createAction(),
        windupMs: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(RangeError);
  });
});
