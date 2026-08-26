import type { CombatOutcomeRoute } from "../combat/combat-outcome-routing";
import type { GeneratedMapNode } from "@typing-roguelike/shared";
import { SCENE_KEYS } from "../scenes/scene-contract";
import { RUN_RESUME_CHECKPOINT_VERSION } from "./run-resume-checkpoint";
import { runSession, type RunSession } from "./run-session";

export const persistTerminalRunTransition = (
  route: CombatOutcomeRoute,
  session: RunSession = runSession,
): boolean => {
  if (
    route.sceneKey !== SCENE_KEYS.runResult ||
    (route.runState.status !== "dead" && route.runState.status !== "cleared")
  ) {
    return false;
  }

  session.replace(route.runState);
  return true;
};

export type PersistCombatRunTransitionOptions = Readonly<{
  node?: GeneratedMapNode;
  nextNodeIds?: readonly string[];
}>;

export const persistCombatRunTransition = (
  route: CombatOutcomeRoute,
  options: PersistCombatRunTransitionOptions = {},
  session: RunSession = runSession,
): boolean => {
  if (persistTerminalRunTransition(route, session)) return true;
  if (!route.applied || route.runState.status !== "active") return false;

  session.replace(route.runState);
  const rewardEquipmentIds = route.payload.rewardEquipmentIds;
  const rewardRelicIds = route.payload.rewardRelicIds;
  const validRewardRelicIds = Array.isArray(rewardRelicIds) &&
    rewardRelicIds.every((id): id is string => typeof id === "string")
    ? rewardRelicIds
    : undefined;
  if (
    route.sceneKey === SCENE_KEYS.reward &&
    options.node !== undefined &&
    Array.isArray(rewardEquipmentIds) &&
    rewardEquipmentIds.length +
      (validRewardRelicIds?.length ?? 0) > 0 &&
    rewardEquipmentIds.every((id) => typeof id === "string") &&
    (validRewardRelicIds === undefined || validRewardRelicIds.length > 0)
  ) {
    session.setCheckpoint({
      version: RUN_RESUME_CHECKPOINT_VERSION,
      sceneKey: SCENE_KEYS.reward,
      node: options.node,
      nextNodeIds: options.nextNodeIds ?? [],
      rewardEquipmentIds,
      ...(validRewardRelicIds === undefined ? {} : { rewardRelicIds: validRewardRelicIds }),
    });
  } else {
    session.clearCheckpoint();
  }
  return true;
};
