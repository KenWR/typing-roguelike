import {
  completeMapNode,
  type GeneratedMapNode,
  type RunState,
} from "@typing-roguelike/shared";
import { SCENE_KEYS } from "../scenes/scene-contract";
import { finalizeBossCombat } from "./boss-combat-flow";
import { CombatState, type CombatOutcome } from "./combat-state";
import { EnemyAttackTimeline } from "./enemy-attack-timeline";

export type CombatOutcomeRoute = Readonly<{
  applied: boolean;
  runState: RunState;
  sceneKey: typeof SCENE_KEYS.map | typeof SCENE_KEYS.runResult;
  payload: Readonly<Record<string, unknown>>;
}>;

export type FinalizeCombatOutcomeInput = Readonly<{
  combat: CombatState;
  enemyTimeline: EnemyAttackTimeline;
  runState: RunState;
  outcome: CombatOutcome;
  nextNodeIds?: readonly string[];
  bossNode?: GeneratedMapNode;
}>;

export const finalizeCombatOutcome = ({
  combat,
  enemyTimeline,
  runState,
  outcome,
  nextNodeIds = [],
  bossNode,
}: FinalizeCombatOutcomeInput): CombatOutcomeRoute => {
  combat.finish(outcome);
  enemyTimeline.finish(outcome);

  if (bossNode !== undefined) {
    const bossRoute = finalizeBossCombat(runState, bossNode, outcome);
    return {
      applied: bossRoute.runState !== runState,
      runState: bossRoute.runState,
      sceneKey: bossRoute.sceneKey,
      payload: bossRoute.payload,
    };
  }

  if (outcome === "defeat") {
    const alreadyEnded = runState.status !== "active";
    const endedRunState: RunState = alreadyEnded ? runState : { ...runState, status: "dead" };
    return {
      applied: !alreadyEnded,
      runState: endedRunState,
      sceneKey: SCENE_KEYS.runResult,
      payload: { runState: endedRunState, result: "death" },
    };
  }

  const completion = completeMapNode(runState.map, runState.map.currentNodeId, nextNodeIds);
  const updatedRunState: RunState = completion.applied ? { ...runState, map: completion.map } : runState;
  return {
    applied: completion.applied,
    runState: updatedRunState,
    sceneKey: SCENE_KEYS.map,
    payload: { runState: updatedRunState },
  };
};
