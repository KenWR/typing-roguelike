import {
  completeMapNode,
  generateEquipmentRewardCandidates,
  type EquipmentRewardTier,
  type GeneratedMapNode,
  type RunState,
} from "@typing-roguelike/shared";
import { createRunRewardSelectionFlow } from "../rewards/run-reward-selection";
import { SCENE_KEYS } from "../scenes/scene-contract";
import { finalizeBossCombat } from "./boss-combat-flow";
import { CombatState, type CombatOutcome } from "./combat-state";
import { EnemyAttackTimeline } from "./enemy-attack-timeline";

const GOLD_MULTIPLIER_BY_TIER: Readonly<Record<EquipmentRewardTier, number>> = {
  normal: 10,
  elite: 20,
  boss: 30,
};

export const calculateCombatVictoryGold = (
  floor: number,
  rewardTier: EquipmentRewardTier,
): number => {
  if (!Number.isSafeInteger(floor) || floor < 1) {
    throw new RangeError("Combat reward floor must be a positive safe integer.");
  }
  return floor * GOLD_MULTIPLIER_BY_TIER[rewardTier];
};

export type CombatOutcomeRoute = Readonly<{
  applied: boolean;
  runState: RunState;
  sceneKey:
    | typeof SCENE_KEYS.map
    | typeof SCENE_KEYS.reward
    | typeof SCENE_KEYS.runResult;
  payload: Readonly<Record<string, unknown>>;
}>;

export type FinalizeCombatOutcomeInput = Readonly<{
  combat: CombatState;
  enemyTimeline: EnemyAttackTimeline;
  runState: RunState;
  outcome: CombatOutcome;
  nextNodeIds?: readonly string[];
  bossNode?: GeneratedMapNode;
  rewardTier?: EquipmentRewardTier;
  rewardCount?: number;
  rewardRandom?: () => number;
}>;

export const finalizeCombatOutcome = ({
  combat,
  enemyTimeline,
  runState,
  outcome,
  nextNodeIds = [],
  bossNode,
  rewardTier = "normal",
  rewardCount = 3,
  rewardRandom = Math.random,
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
    const endedRunState: RunState = alreadyEnded
      ? runState
      : { ...runState, status: "dead" };
    return {
      applied: !alreadyEnded,
      runState: endedRunState,
      sceneKey: SCENE_KEYS.runResult,
      payload: { runState: endedRunState, result: "death" },
    };
  }

  const completion = completeMapNode(
    runState.map,
    runState.map.currentNodeId,
    nextNodeIds,
  );
  if (!completion.applied) {
    return {
      applied: false,
      runState,
      sceneKey: SCENE_KEYS.map,
      payload: { runState },
    };
  }

  const goldReward = calculateCombatVictoryGold(
    runState.map.currentRound,
    rewardTier,
  );
  const updatedRunState: RunState = {
    ...runState,
    map: completion.map,
    runCurrency: runState.runCurrency + goldReward,
  };
  const candidates = generateEquipmentRewardCandidates({
    tier: rewardTier,
    count: rewardCount,
    random: rewardRandom,
    excludedEquipmentIds: updatedRunState.inventory.itemInstances,
  });

  if (candidates.length === 0) {
    return {
      applied: true,
      runState: updatedRunState,
      sceneKey: SCENE_KEYS.map,
      payload: { runState: updatedRunState, goldReward },
    };
  }

  const rewardFlow = createRunRewardSelectionFlow({
    runState: updatedRunState,
    equipmentIds: candidates.map(({ id }) => id),
  });

  return {
    applied: true,
    runState: updatedRunState,
    sceneKey: SCENE_KEYS.reward,
    payload: {
      runState: updatedRunState,
      adapter: rewardFlow.adapter,
      nextSceneKey: rewardFlow.nextSceneKey,
      rewardEquipmentIds: candidates.map(({ id }) => id),
      rewardSource: "combat-victory",
      goldReward,
    },
  };
};
