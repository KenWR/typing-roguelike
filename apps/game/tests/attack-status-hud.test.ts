import { describe, expect, test } from "bun:test";
import {
  createAttackStatusHudState,
  type AttackStatusHudState,
} from "../src/game/hud/attack-status-hud";

const createSnapshot = (): Parameters<typeof createAttackStatusHudState>[0] => ({
  status: "active",
  elapsedMs: 750,
  attacks: [
    {
      timelineId: "slime-ink-1",
      enemyId: "ink-slime",
      targetId: "player",
      attackId: "ink-splash",
      attackName: "먹물 튀기기",
      attackType: "debuff",
      phase: "windup",
      phaseElapsedMs: 200,
      phaseDurationMs: 400,
      phaseProgress: 0.5,
      castCompleted: false,
      impactResolved: false,
    },
    {
      timelineId: "bat-cry-1",
      enemyId: "reverse-bat",
      targetId: "player",
      attackId: "reversed-cry",
      attackName: "뒤집힌 울음",
      attackType: "attack",
      phase: "recovery",
      phaseElapsedMs: 150,
      phaseDurationMs: 600,
      phaseProgress: 0.25,
      castCompleted: true,
      impactResolved: false,
    },
    {
      timelineId: "club-smash-1",
      enemyId: "club-goblin",
      targetId: "player",
      attackId: "club-smash",
      attackName: "곤봉 내려치기",
      attackType: "attack",
      phase: "resolved",
      phaseElapsedMs: 0,
      phaseDurationMs: 0,
      phaseProgress: 1,
      castCompleted: true,
      impactResolved: true,
    },
  ],
});

describe("attack status HUD view state", () => {
  test("keeps the cast gauge separate from a cast-completed attack awaiting impact", () => {
    const state = createAttackStatusHudState(createSnapshot());

    expect(state.attacks).toEqual([
      expect.objectContaining({
        timelineId: "slime-ink-1",
        phase: "windup",
        kind: "cast",
        label: "시전 게이지",
        progress: 0.5,
        remainingMs: 200,
      }),
      expect.objectContaining({
        timelineId: "bat-cry-1",
        phase: "recovery",
        kind: "impact",
        label: "타격 대기",
        progress: 0.25,
        remainingMs: 450,
      }),
    ] satisfies AttackStatusHudState["attacks"]);
  });

  test("retains a post-cast status until the impact is resolved", () => {
    const snapshot = createSnapshot();
    const postCast = createAttackStatusHudState(snapshot).attacks[1];

    expect(postCast).toMatchObject({
      timelineId: "bat-cry-1",
      castCompleted: true,
      impactResolved: false,
      phase: "recovery",
    });

    expect(
      createAttackStatusHudState({
        ...snapshot,
        attacks: snapshot.attacks.map((attack) =>
          attack.timelineId === "bat-cry-1"
            ? { ...attack, phase: "resolved", impactResolved: true }
            : attack,
        ),
      }).attacks,
    ).toEqual([
      expect.objectContaining({ timelineId: "slime-ink-1" }),
    ]);
  });
});
