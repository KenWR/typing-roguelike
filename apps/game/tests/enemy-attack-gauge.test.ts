import { describe, expect, test } from "bun:test";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { ENEMY_HEALTH_BAR_TRACK_WIDTH } from "../src/game/combat/enemy-health-bar";
import {
  createEnemyAttackGaugeState,
  ENEMY_ATTACK_GAUGE_TRACK_WIDTH,
  getEnemyAttackTypePresentation,
} from "../src/game/hud/enemy-attack-gauge";

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

describe("enemy attack gauge state", () => {
  test("uses the enemy health bar track width", () => {
    expect(ENEMY_ATTACK_GAUGE_TRACK_WIDTH).toBe(ENEMY_HEALTH_BAR_TRACK_WIDTH);
  });

  test("maps wind-up progress to the horizontal gauge ratio", () => {
    const timeline = new EnemyAttackTimeline();
    timeline.startAttack(createAttack());

    const state = createEnemyAttackGaugeState(timeline.advance(100).snapshot);

    expect(state.attacks).toMatchObject([
      {
        timelineId: "slime-ink-1",
        attackName: "먹물 튀기기",
        attackType: "debuff",
        phase: "windup",
        phaseProgress: 0.25,
        progress: 0.25,
        phaseLabel: "선딜",
        typeLabel: "약화",
        icon: "☠",
      },
    ]);
  });

  test("keeps simultaneous attack timelines as separate typed rows", () => {
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

    const state = createEnemyAttackGaugeState(
      timeline.advance(100).snapshot,
    );

    expect(state.attacks).toMatchObject([
      {
        timelineId: "slime-ink-1",
        progress: 0.25,
        typeLabel: "약화",
      },
      {
        timelineId: "bat-cry-1",
        progress: 0.5,
        typeLabel: "공격",
      },
    ]);
    expect(state.attacks).toHaveLength(2);
  });

  test("marks the telegraph belonging to the selected enemy", () => {
    const timeline = new EnemyAttackTimeline();
    timeline.startAttack(createAttack());
    timeline.startAttack({
      ...createAttack(),
      timelineId: "bat-cry-1",
      enemyId: "reverse-bat",
    });

    const state = createEnemyAttackGaugeState(
      timeline.advance(100).snapshot,
      "reverse-bat",
    );

    expect(state.attacks.map(({ targeted }) => targeted)).toEqual([false, true]);
  });

  test("keeps recovery visible but removes resolved attacks immediately", () => {
    const timeline = new EnemyAttackTimeline();
    timeline.startAttack({
      ...createAttack(),
      attackType: "buff",
      windupMs: 100,
      recoveryMs: 200,
    });

    const recoveryState = createEnemyAttackGaugeState(
      timeline.advance(100).snapshot,
    );
    const resolvedTimelineSnapshot = timeline.advance(200).snapshot;
    const resolvedState = createEnemyAttackGaugeState(resolvedTimelineSnapshot);

    expect(recoveryState.attacks[0]).toMatchObject({
      phase: "recovery",
      phaseProgress: 0,
      progress: 1,
      phaseLabel: "후딜",
    });
    expect(resolvedTimelineSnapshot.attacks[0]?.phase).toBe("resolved");
    expect(resolvedState.attacks).toEqual([]);
    expect(getEnemyAttackTypePresentation("buff")).toMatchObject({
      icon: "✦",
      label: "강화",
    });
  });
});
