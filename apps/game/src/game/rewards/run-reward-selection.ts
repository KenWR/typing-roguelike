import {
  EQUIPMENT_CONFIGS,
  completeMapNode,
  generateEquipmentRewardCandidates,
  type EquipmentConfig,
  type RunState,
  type SkillConfig,
} from "@typing-roguelike/shared";
import { resolveEquipmentIconTextureKey } from "../assets/equipment-icon-assets";
import { SCENE_KEYS } from "../scenes/scene-contract";
import {
  createRewardSelectionAdapter,
  type RewardSelectionAdapter,
} from "./reward-selection-adapter";
import {
  createRewardSelectionViewState,
  type RewardCandidate,
  type RewardRarity,
} from "./reward-selection-view-state";

const findEquipment = (equipmentId: string): EquipmentConfig => {
  const equipment = EQUIPMENT_CONFIGS.find((candidate) => candidate.id === equipmentId);
  if (equipment === undefined) {
    throw new Error(`Unknown equipment reward: ${equipmentId}`);
  }
  return equipment;
};

const toRewardRarity = (rarity: EquipmentConfig["rarity"]): RewardRarity =>
  rarity === "hidden" ? "legendary" : rarity;

const toRewardCandidate = (equipment: EquipmentConfig): RewardCandidate => ({
  id: equipment.id,
  kind: "weapon",
  name: equipment.name,
  rarity: toRewardRarity(equipment.rarity),
  description: `${equipment.slot === "weapon" ? "주무기" : "보조무기"} · ${equipment.kind}`,
  effect: `공격 ${equipment.baseAttack ?? 0} · 사용 스킬 ${equipment.skills.length}개`,
  icon: equipment.slot === "weapon" ? "⚔" : "◇",
  imageKey: resolveEquipmentIconTextureKey(equipment.id),
});

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const getRewardEquipment = (
  runState: Readonly<RunState>,
  nodeId: string | undefined,
): readonly EquipmentConfig[] =>
  generateEquipmentRewardCandidates({
    tier: "normal",
    count: 3,
    random: createSeededRandom(runState.map.seed ^ hashString(nodeId ?? runState.map.currentNodeId)),
    excludedEquipmentIds: runState.inventory.itemInstances,
  });

export const getRunAvailableSkills = (runState: Readonly<RunState>): readonly SkillConfig[] => {
  const equippedIds = [runState.loadout.weaponId, runState.loadout.subweaponId].filter(
    (equipmentId): equipmentId is string => equipmentId !== null,
  );

  return equippedIds.flatMap((equipmentId) => findEquipment(equipmentId).skills);
};

export const applyEquipmentReward = (
  runState: Readonly<RunState>,
  equipmentId: string,
): RunState => {
  const equipment = findEquipment(equipmentId);
  const alreadyOwned = runState.inventory.itemInstances.includes(equipment.id);

  return {
    ...runState,
    inventory: {
      ...runState.inventory,
      itemInstances: alreadyOwned
        ? [...runState.inventory.itemInstances]
        : [...runState.inventory.itemInstances, equipment.id],
    },
    loadout: {
      ...runState.loadout,
      ...(equipment.slot === "weapon"
        ? { weaponId: equipment.id }
        : { subweaponId: equipment.id }),
    },
  };
};

export type RunRewardSelectionFlow = Readonly<{
  adapter: RewardSelectionAdapter<RunState>;
  nextSceneKey: typeof SCENE_KEYS.map;
  getAvailableSkills: () => readonly SkillConfig[];
}>;

export type CreateRunRewardSelectionFlowOptions = Readonly<{
  runState: RunState;
  nodeId?: string;
  nextNodeIds?: readonly string[];
  equipmentIds?: readonly string[];
  mapCompletion?: Readonly<{
    nodeId: string;
    nextNodeIds: readonly string[];
  }>;
  onContinue?: (runState: RunState) => void;
}>;

export const createRunRewardSelectionFlow = ({
  runState,
  nodeId,
  nextNodeIds = [],
  equipmentIds,
  mapCompletion,
  onContinue,
}: CreateRunRewardSelectionFlowOptions): RunRewardSelectionFlow => {
  const completionTarget = mapCompletion ?? (nodeId === undefined ? undefined : { nodeId, nextNodeIds });
  const equipmentRewards = equipmentIds === undefined
    ? getRewardEquipment(runState, completionTarget?.nodeId ?? nodeId)
    : equipmentIds.map(findEquipment);
  if (equipmentRewards.length === 0) {
    throw new RangeError("At least one equipment reward is required.");
  }

  const adapter = createRewardSelectionAdapter<RunState>({
    initialViewState: createRewardSelectionViewState({
      candidates: equipmentRewards.map(toRewardCandidate),
      round: runState.map.currentRound,
      currency: runState.runCurrency,
    }),
    initialRunState: runState,
    applySelection: (currentRunState, reward) => {
      const rewardedRun = applyEquipmentReward(currentRunState, reward.id);
      if (completionTarget === undefined) return rewardedRun;

      const completion = completeMapNode(
        rewardedRun.map,
        completionTarget.nodeId,
        completionTarget.nextNodeIds,
      );
      return completion.applied ? { ...rewardedRun, map: completion.map } : rewardedRun;
    },
    onContinue: (completedRunState) => onContinue?.(completedRunState),
  });

  return {
    adapter,
    nextSceneKey: SCENE_KEYS.map,
    getAvailableSkills: () => getRunAvailableSkills(adapter.getRunState()),
  };
};
