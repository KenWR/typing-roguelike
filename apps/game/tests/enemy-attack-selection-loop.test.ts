import { describe, expect, test } from "bun:test";
import type { EnemyConfig } from "@typing-roguelike/shared";
import { EnemyAttackSelectionLoop } from "../src/game/combat/enemy-attack-selection-loop";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";

const enemy: EnemyConfig = {
  id: "test-enemy",
  name: "테스트 적",
  tier: "normal",
  role: "pressure",
  hp: 50,
  allowedFloors: [1],
  actions: [
    {
      id: "jab",
      kind: "attack",
      name: "찌르기",
      damage: 8,
      windupMs: 500,
      recoveryMs: 200,
      description: "빠른 찌르기",
      animation: { windup: "jab-windup", impact: "jab-impact" },
    },
    {
      id: "guard",
      kind: "defense",
      name: "방어",
      damage: 0,
      windupMs: 300,
      recoveryMs: 250,
      defenseAmount: 10,
      description: "방어 자세",
      animation: { windup: "guard-windup" },
    },
  ],
  reward: { weight: 1 },
  assetKey: "enemy:test-enemy",
};

describe("EnemyAttackSelectionLoop", () => {
  test("selects an action for a living enemy and starts its timeline", () => {
    const timeline = new EnemyAttackTimeline();
    const loop = new EnemyAttackSelectionLoop(timeline, () => 0);

    const result = loop.selectAndStart({ enemy, currentHp: 50 }, "player");

    expect(result.started).toBe(true);
    expect(result.action?.id).toBe("jab");
    expect(result.update?.snapshot.attacks).toHaveLength(1);
    expect(result.update?.snapshot.attacks[0]).toMatchObject({
      enemyId: "test-enemy",
      targetId: "player",
      attackId: "jab",
      attackType: "attack",
      phase: "windup",
    });
  });

  test("uses the configured action list for deterministic selection", () => {
    const timeline = new EnemyAttackTimeline();
    const loop = new EnemyAttackSelectionLoop(timeline, () => 0.75);

    const result = loop.selectAndStart({ enemy, currentHp: 50 }, "player");

    expect(result.action?.id).toBe("guard");
    expect(result.update?.snapshot.attacks[0]?.attackType).toBe("defense");
  });

  test("does not start a new attack for a dead enemy", () => {
    const timeline = new EnemyAttackTimeline();
    const loop = new EnemyAttackSelectionLoop(timeline, () => 0);

    const result = loop.selectAndStart({ enemy, currentHp: 0 }, "player");

    expect(result).toMatchObject({ started: false, action: null, update: null });
    expect(timeline.snapshot.attacks).toHaveLength(0);
  });

  test("does not start a new attack after combat has ended", () => {
    const timeline = new EnemyAttackTimeline();
    timeline.finish("victory");
    const loop = new EnemyAttackSelectionLoop(timeline, () => 0);

    const result = loop.selectAndStart({ enemy, currentHp: 50 }, "player");

    expect(result).toMatchObject({ started: false, action: null, update: null });
    expect(timeline.snapshot.attacks).toHaveLength(0);
  });

  test("creates a distinct timeline id for repeated attacks", () => {
    const timeline = new EnemyAttackTimeline();
    const loop = new EnemyAttackSelectionLoop(timeline, () => 0);

    const first = loop.selectAndStart({ enemy, currentHp: 50 }, "player");
    const second = loop.selectAndStart({ enemy, currentHp: 50 }, "player");

    expect(first.update?.snapshot.attacks[0]?.timelineId).toBe("test-enemy:jab:1");
    expect(second.update?.snapshot.attacks[1]?.timelineId).toBe("test-enemy:jab:2");
  });

  test("rejects invalid random values instead of selecting unpredictably", () => {
    const timeline = new EnemyAttackTimeline();
    const loop = new EnemyAttackSelectionLoop(timeline, () => 1);

    expect(() => loop.selectAndStart({ enemy, currentHp: 50 }, "player")).toThrow(
      RangeError,
    );
  });
});
