import { describe, expect, test } from "bun:test";
import {
  buildOverlappingAttackSchedule,
  getOverlappingAttackEvents,
  getScheduledAttackPhase,
} from "../src/game/combat/overlapping-attack-schedule";

describe("overlapping attack schedule", () => {
  test("starts the next windup exactly when the previous cast completes", () => {
    const schedule = buildOverlappingAttackSchedule([
      { id: "first", windupMs: 1000, recoveryMs: 700 },
      { id: "second", windupMs: 400, recoveryMs: 300 },
    ]);

    expect(schedule[0]).toEqual({
      id: "first",
      startAtMs: 0,
      castCompletedAtMs: 1000,
      recoveryCompletedAtMs: 1700,
    });
    expect(schedule[1]).toEqual({
      id: "second",
      startAtMs: 1000,
      castCompletedAtMs: 1400,
      recoveryCompletedAtMs: 1700,
    });

    expect(getScheduledAttackPhase(schedule[0]!, 1200)).toBe("recovery");
    expect(getScheduledAttackPhase(schedule[1]!, 1200)).toBe("windup");
  });

  test("keeps events ordered by absolute combat time", () => {
    const events = getOverlappingAttackEvents(
      buildOverlappingAttackSchedule([
        { id: "slow", windupMs: 1000, recoveryMs: 900 },
        { id: "fast", windupMs: 200, recoveryMs: 100 },
        { id: "third", windupMs: 300, recoveryMs: 200 },
      ]),
    );

    expect(events.map((event) => `${event.atMs}:${event.type}:${event.attackId}`)).toEqual([
      "0:attack-started:slow",
      "1000:cast-completed:slow",
      "1000:attack-started:fast",
      "1200:cast-completed:fast",
      "1200:attack-started:third",
      "1300:recovery-completed:fast",
      "1500:cast-completed:third",
      "1700:recovery-completed:third",
      "1900:recovery-completed:slow",
    ]);
  });

  test("supports zero-duration phases without delaying the next attack", () => {
    const schedule = buildOverlappingAttackSchedule([
      { id: "instant", windupMs: 0, recoveryMs: 500 },
      { id: "next", windupMs: 250, recoveryMs: 0 },
    ]);

    expect(schedule[0]?.castCompletedAtMs).toBe(0);
    expect(schedule[1]?.startAtMs).toBe(0);
    expect(schedule[1]?.recoveryCompletedAtMs).toBe(250);
  });

  test("rejects invalid ids, durations, and start times", () => {
    expect(() =>
      buildOverlappingAttackSchedule([{ id: "", windupMs: 1, recoveryMs: 1 }]),
    ).toThrow(RangeError);
    expect(() =>
      buildOverlappingAttackSchedule([{ id: "a", windupMs: -1, recoveryMs: 1 }]),
    ).toThrow(RangeError);
    expect(() =>
      buildOverlappingAttackSchedule([{ id: "a", windupMs: 1, recoveryMs: 1 }], -1),
    ).toThrow(RangeError);
  });
});
