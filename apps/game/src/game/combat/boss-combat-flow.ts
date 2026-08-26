import {
  beginMapNode,
  completeFinalBossVictory,
  getMapNodeStatus,
  type GeneratedMapNode,
  type RunState,
} from "@typing-roguelike/shared";
import { SCENE_KEYS } from "../scenes/scene-contract";
import {
  initializeCombatEncounter,
  type CombatEncounterInitialization,
} from "./encounter-initializer";

export type BossCombatEntry =
  | Readonly<{
      ok: true;
      runState: RunState;
      combat: CombatEncounterInitialization;
      sceneKey: typeof SCENE_KEYS.combat;
    }>
  | Readonly<{
      ok: false;
      reason: "not-boss" | "boss-locked" | "encounter-invalid";
      runState: RunState;
      sceneKey: typeof SCENE_KEYS.map;
    }>;

export type BossCombatSettlementRoute = Readonly<{
  runState: RunState;
  sceneKey: typeof SCENE_KEYS.runResult;
  payload: Readonly<{ runState: RunState; result: "clear" | "death" }>;
}>;

export const enterBossCombat = (
  runState: RunState,
  bossNode: GeneratedMapNode,
): BossCombatEntry => {
  if (bossNode.type !== "boss") {
    return { ok: false, reason: "not-boss", runState, sceneKey: SCENE_KEYS.map };
  }
  if (getMapNodeStatus(runState.map, bossNode.key) !== "available") {
    return { ok: false, reason: "boss-locked", runState, sceneKey: SCENE_KEYS.map };
  }

  const enteredRunState: RunState = {
    ...runState,
    map: beginMapNode(runState.map, bossNode.key),
  };
  const encounter = initializeCombatEncounter(enteredRunState, bossNode);
  if (!encounter.ok) {
    return {
      ok: false,
      reason: "encounter-invalid",
      runState,
      sceneKey: SCENE_KEYS.map,
    };
  }

  return {
    ok: true,
    runState: enteredRunState,
    combat: encounter.combat,
    sceneKey: SCENE_KEYS.combat,
  };
};

export const finalizeBossCombat = (
  runState: RunState,
  bossNode: GeneratedMapNode,
  outcome: "victory" | "defeat",
): BossCombatSettlementRoute => {
  if (outcome === "defeat") {
    const deadRunState: RunState =
      runState.status === "active" ? { ...runState, status: "dead" } : runState;
    return {
      runState: deadRunState,
      sceneKey: SCENE_KEYS.runResult,
      payload: { runState: deadRunState, result: "death" },
    };
  }

  const cleared = completeFinalBossVictory(runState, bossNode).state;
  return {
    runState: cleared,
    sceneKey: SCENE_KEYS.runResult,
    payload: { runState: cleared, result: "clear" },
  };
};
