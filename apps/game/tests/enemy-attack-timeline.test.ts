import { describe, expect, test } from "bun:test";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";

const createAttack = () => ({
  timelineId: "slime-ink-1",
  enemyId: "ink-slime",
  targetId: "player",
  attackId: "ink-splash",
  attackName: "먹물 튀기기",
  attackType: "debuff" as const,
  windupMs: 400,
  recoveryMs: 600,
});

describe("EnemyAttackTimeline", () => {
  test("exposes attack identity, type, phase, and UI-readable progress", () => {
    const timeline = new EnemyAttackTimeline();
    timeline.startAttack(createAttack());

    expect(timeline.advance(100)).toMatchObject({
      events: [],
      snapshot: {
        status: "active",
        elapsedMs: 100,
        attacks: [
          {
            timelineId: "slime-ink-1",
            enemyId: "ink-slime",
            targetId: "player",
            attackId: "ink-splash",
            attackName: "먹물 튀기기",
            attackType: "debuff",
            phase: "windup",
            phaseElapsedMs: 100,
            phaseDurationMs: 400,
            phaseProgress: 0.25,
            castCompleted: false,
            impactResolved: false,
          },
        ],
      },
    });
  });

  test("distinguishes cast completion from the later impact", () => {
    const timeline = new EnemyAttackTimeline();
    timeline.startAttack(createAttack());

    expect(timeline.advance(400)).toMatchObject({
      events: [
        {
          type: "cast-completed",
          timelineId: "slime-ink-1",
          attackId: "ink-splash",
          attackType: "debuff",
          atMs: 400,
        },
      ],
      snapshot: {
        attacks: [
          {
            phase: "recovery",
            phaseProgress: 0,
            castCompleted: true,
            impactResolved: false,
          },
        ],
      },
    });

    expect(timeline.advance(600)).toMatchObject({
      events: [
        {
          type: "impact-resolved",
          timelineId: "slime-ink-1",
          atMs: 1_000,
        },
      ],
      snapshot: {
        attacks: [
          {
            phase: "resolved",
            phaseProgress: 1,
            impactResolved: true,
          },
        ],
      },
    });
  });

  test("advances simultaneous attacks independently and orders events", () => {
    const timeline = new EnemyAttackTimeline();
    timeline.startAttack(createAttack());
    timeline.startAttack({
      ...createAttack(),
      timelineId: "bat-cry-1",
      enemyId: "reverse-bat",
      attackId: "reversed-cry",
      attackName: "뒤집힌 울음",
      attackType: "attack",
      windupMs: 200,
      recoveryMs: 100,
    });

    const update = timeline.advance(500);

    expect(update.events.map(({ type, timelineId, atMs }) => ({
      type,
      timelineId,
      atMs,
    }))).toEqual([
      {
        type: "cast-completed",
        timelineId: "bat-cry-1",
        atMs: 200,
      },
      {
        type: "impact-resolved",
        timelineId: "bat-cry-1",
        atMs: 300,
      },
      {
        type: "cast-completed",
        timelineId: "slime-ink-1",
        atMs: 400,
      },
    ]);
    expect(update.snapshot.attacks).toMatchObject([
      {
        timelineId: "slime-ink-1",
        phase: "recovery",
        phaseElapsedMs: 100,
        phaseProgress: 1 / 6,
      },
      {
        timelineId: "bat-cry-1",
        phase: "resolved",
        impactResolved: true,
      },
    ]);
  });

  test("freezes every attack while paused", () => {
    const timeline = new EnemyAttackTimeline();
    timeline.startAttack(createAttack());
    timeline.advance(100);

    timeline.pause();
    expect(timeline.advance(1_000)).toMatchObject({
      events: [],
      snapshot: {
        status: "paused",
        elapsedMs: 100,
        attacks: [{ phase: "windup", phaseElapsedMs: 100 }],
      },
    });

    timeline.resume();
    expect(timeline.advance(300).events).toMatchObject([
      { type: "cast-completed", atMs: 400 },
    ]);
  });

  test("rejects duplicate timelines and invalid labels or durations", () => {
    const timeline = new EnemyAttackTimeline();
    timeline.startAttack(createAttack());

    expect(() => timeline.startAttack(createAttack())).toThrow(
      "Timeline id already exists",
    );
    expect(() =>
      new EnemyAttackTimeline().startAttack({
        ...createAttack(),
        attackName: " ",
      }),
    ).toThrow(RangeError);
    expect(() =>
      new EnemyAttackTimeline().startAttack({
        ...createAttack(),
        windupMs: -1,
      }),
    ).toThrow(RangeError);
  });
});
