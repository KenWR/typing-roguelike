import { describe, expect, test } from "bun:test";
import { createInitialRunState, generateNodeChoices, type RunState } from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { finalizeCombatOutcome } from "../src/game/combat/combat-outcome-routing";
import { routeMapNodeSelection } from "../src/game/run/map-node-routing";
import { SCENE_KEYS } from "../src/game/scenes/scene-contract";

const bossRun = (): { run: RunState; boss: ReturnType<typeof generateNodeChoices>[number] } => {
  const path = Array.from({ length: 9 }, () => 1);
  const boss = generateNodeChoices(17, 10, path)[0]!;
  const base = createInitialRunState({ seed: 17 });
  return {
    boss,
    run: {
      ...base,
      map: {
        ...base.map,
        currentRound: 10,
        choicePath: path,
        currentNodeId: boss.parentKey,
        nodeStatuses: { [boss.key]: "available" },
      },
    },
  };
};

describe("final boss routing", () => {
  test("locked boss cannot be entered", () => {
    const { run, boss } = bossRun();
    const locked = { ...run, map: { ...run.map, nodeStatuses: { [boss.key]: "locked" as const } } };
    const route = routeMapNodeSelection(locked, boss.key);
    expect(route.applied).toBe(false);
    expect(route.sceneKey).toBe(SCENE_KEYS.map);
  });

  test("available final boss enters combat with explicit boss payload", () => {
    const { run, boss } = bossRun();
    const route = routeMapNodeSelection(run, boss.key);
    expect(route.applied).toBe(true);
    expect(route.sceneKey).toBe(SCENE_KEYS.combat);
    expect(route.runState.map.nodeStatuses[boss.key]).toBe("available");
    expect(route.payload.bossNode).toEqual(boss);
  });

  test("boss victory clears run and routes to clear settlement", () => {
    const { run, boss } = bossRun();
    const entered = routeMapNodeSelection(run, boss.key);
    const result = finalizeCombatOutcome({
      combat: new CombatState(),
      enemyTimeline: new EnemyAttackTimeline(),
      runState: entered.runState,
      outcome: "victory",
      bossNode: boss,
    });
    expect(result.runState.status).toBe("cleared");
    expect(result.sceneKey).toBe(SCENE_KEYS.runResult);
    expect(result.payload.result).toBe("clear");
    expect(result.runState.map.nodeStatuses[boss.key]).toBe("cleared");
  });

  test("ordinary victory cannot clear the run", () => {
    const base = createInitialRunState({ seed: 4 });
    const run = { ...base, map: { ...base.map, currentNodeId: "normal", nodeStatuses: { normal: "in_progress" as const } } };
    const result = finalizeCombatOutcome({
      combat: new CombatState(),
      enemyTimeline: new EnemyAttackTimeline(),
      runState: run,
      outcome: "victory",
    });
    expect(result.runState.status).toBe("active");
    expect(result.sceneKey).toBe(SCENE_KEYS.reward);
    expect(result.payload.nextSceneKey).toBe(SCENE_KEYS.map);
  });
});
