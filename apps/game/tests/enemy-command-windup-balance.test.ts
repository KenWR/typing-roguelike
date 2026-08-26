import { describe, expect, test } from "bun:test";
import { ENEMY_CONFIGS } from "@typing-roguelike/shared";
import {
  applyEnemyCommandWindupMultiplier,
  ENEMY_COMMAND_WINDUP_MULTIPLIER,
  EnemyAttackSelectionLoop,
} from "../src/game/combat/enemy-attack-selection-loop";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";

const selectAction = (enemyIndex: number, actionIndex: number) => {
  const enemy = ENEMY_CONFIGS[enemyIndex];
  if (enemy === undefined) {
    throw new Error(`Missing enemy fixture at index ${enemyIndex}`);
  }

  const action = enemy.actions[actionIndex];
  if (action === undefined) {
    throw new Error(`Missing action fixture at index ${actionIndex} for ${enemy.id}`);
  }

  const timeline = new EnemyAttackTimeline();
  const random = () => (actionIndex + 0.5) / enemy.actions.length;
  const loop = new EnemyAttackSelectionLoop(timeline, random);
  const result = loop.selectAndStart({ enemy, currentHp: enemy.hp }, "player");

  return { enemy, action, timeline, result };
};

const findEnemyIndex = (enemyId: string): number => {
  const index = ENEMY_CONFIGS.findIndex((enemy) => enemy.id === enemyId);
  if (index < 0) {
    throw new Error(`Missing enemy fixture: ${enemyId}`);
  }
  return index;
};

const findActionIndex = (enemyIndex: number, actionId: string): number => {
  const enemy = ENEMY_CONFIGS[enemyIndex];
  if (enemy === undefined) {
    throw new Error(`Missing enemy fixture at index ${enemyIndex}`);
  }
  const index = enemy.actions.findIndex((action) => action.id === actionId);
  if (index < 0) {
    throw new Error(`Missing action fixture: ${actionId}`);
  }
  return index;
};

describe("enemy command windup balance", () => {
  test("uses the configured content windup without another runtime multiplier", () => {
    expect(ENEMY_COMMAND_WINDUP_MULTIPLIER).toBe(1);
    expect(applyEnemyCommandWindupMultiplier(4_200)).toBe(4_200);
  });

  test("keeps a normal enemy basic attack at its configured 3x windup", () => {
    const enemyIndex = findEnemyIndex("hook-tentacle");
    const { action, result } = selectAction(
      enemyIndex,
      findActionIndex(enemyIndex, "hook-tentacle-attack"),
    );

    expect(action.windupMs).toBe(4_200);
    expect(result.update?.snapshot.attacks[0]?.phaseDurationMs).toBe(4_200);
  });

  test("keeps a normal enemy defense at its configured 3x windup", () => {
    const enemyIndex = findEnemyIndex("hook-tentacle");
    const { action, result } = selectAction(
      enemyIndex,
      findActionIndex(enemyIndex, "hook-tentacle-defense"),
    );

    expect(action.windupMs).toBe(3_000);
    expect(result.update?.snapshot.attacks[0]?.phaseDurationMs).toBe(3_000);
  });

  test("keeps an auto-generated special at its configured 3x windup", () => {
    const enemyIndex = findEnemyIndex("hook-tentacle");
    const { action, result } = selectAction(
      enemyIndex,
      findActionIndex(enemyIndex, "hook-tentacle-special"),
    );

    expect(action.windupMs).toBe(5_400);
    expect(result.update?.snapshot.attacks[0]?.phaseDurationMs).toBe(5_400);
  });

  test("keeps an explicitly configured boss special windup", () => {
    const enemyIndex = findEnemyIndex("palimpsest");
    const { action, result } = selectAction(
      enemyIndex,
      findActionIndex(enemyIndex, "palimpsest-red-edit"),
    );

    expect(action.windupMs).toBe(8_100);
    expect(result.update?.snapshot.attacks[0]?.phaseDurationMs).toBe(8_100);
  });

  test("applies the expected runtime windup to every enemy action without mutating action payloads", () => {
    for (const [enemyIndex, enemy] of ENEMY_CONFIGS.entries()) {
      for (const [actionIndex, action] of enemy.actions.entries()) {
        const { result } = selectAction(enemyIndex, actionIndex);
        const runtimeAttack = result.update?.snapshot.attacks[0];

        expect(action.windupMs).toBeGreaterThan(0);
        expect(runtimeAttack?.phaseDurationMs).toBe(
          action.windupMs * ENEMY_COMMAND_WINDUP_MULTIPLIER,
        );
        expect(result.action?.windupMs).toBe(action.windupMs);
        expect(result.action?.recoveryMs).toBe(action.recoveryMs);
        expect(result.action?.damage).toBe(action.damage);
        expect(result.action?.defenseAmount).toBe(action.defenseAmount);
      }
    }
  });

  test("keeps cast before impact at the configured runtime windup", () => {
    const enemyIndex = findEnemyIndex("hook-tentacle");
    const { timeline } = selectAction(
      enemyIndex,
      findActionIndex(enemyIndex, "hook-tentacle-attack"),
    );

    expect(timeline.advance(4_199).events).toEqual([]);
    expect(timeline.advance(1).events).toMatchObject([
      { type: "cast-completed", atMs: 4_200 },
    ]);
    expect(timeline.advance(299).events).toEqual([]);
    expect(timeline.advance(1).events).toMatchObject([
      { type: "impact-resolved", atMs: 4_500 },
    ]);
  });
});
