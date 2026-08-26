import {
  EQUIPMENT_CONFIGS,
  RELIC_CONFIGS,
  applyRelicAcquisition,
  completeMapNode,
  generateEquipmentRewardCandidates,
  generateRelicRewardCandidates,
  type EquipmentConfig,
  type RelicConfig,
  type RunState,
  type SkillConfig,
} from "@typing-roguelike/shared";
import { getRelicIconTextureKey } from "../assets/asset-catalog";
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

/** 보상 후보 칸 수. 이 중 일부가 유물로 바뀐다. */
const REWARD_CANDIDATE_COUNT = 3;
/** 칸별 유물 등장 확률. 최소 한 칸은 장비로 남긴다. */
const RELIC_REWARD_CHANCE = 1 / 3;

const findEquipment = (equipmentId: string): EquipmentConfig => {
  const equipment = EQUIPMENT_CONFIGS.find((candidate) => candidate.id === equipmentId);
  if (equipment === undefined) {
    throw new Error(`Unknown equipment reward: ${equipmentId}`);
  }
  return equipment;
};

const toRewardRarity = (rarity: EquipmentConfig["rarity"]): RewardRarity =>
  rarity === "hidden" ? "legendary" : rarity;

const findRelic = (relicId: string): RelicConfig => {
  const relic = RELIC_CONFIGS.find((candidate) => candidate.id === relicId);
  if (relic === undefined) {
    throw new Error(`Unknown relic reward: ${relicId}`);
  }
  return relic;
};

const toRelicRewardCandidate = (relic: RelicConfig): RewardCandidate => ({
  id: relic.id,
  kind: "relic",
  name: relic.name,
  rarity: toRewardRarity(relic.rarity),
  description: relic.description,
  effect: `유물 · 획득 시 바로 장착`,
  icon: "◈",
  imageKey: getRelicIconTextureKey(relic.id),
});

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

/**
 * 장비와 유물이 섞인 보상 후보를 만든다.
 *
 * 칸 수는 그대로 두고 일부를 유물로 바꾼다. 유물만 나와서 무기를 갱신할
 * 기회가 사라지지 않도록 최소 한 칸은 장비로 남긴다. 같은 seed 와 노드에서는
 * 항상 같은 결과가 나온다.
 */
const getRewardCandidates = (
  runState: Readonly<RunState>,
  nodeId: string | undefined,
): readonly RewardCandidate[] => {
  const random = createSeededRandom(
    runState.map.seed ^ hashString(nodeId ?? runState.map.currentNodeId),
  );

  let relicCount = 0;
  for (let slot = 0; slot < REWARD_CANDIDATE_COUNT - 1; slot += 1) {
    if (random() < RELIC_REWARD_CHANCE) relicCount += 1;
  }

  const relics = generateRelicRewardCandidates({
    count: relicCount,
    random,
    excludedRelicIds: runState.inventory.relicInstances,
  });
  const equipment = generateEquipmentRewardCandidates({
    tier: "normal",
    count: REWARD_CANDIDATE_COUNT - relics.length,
    random,
    excludedEquipmentIds: runState.inventory.itemInstances,
  });

  return [...equipment.map(toRewardCandidate), ...relics.map(toRelicRewardCandidate)];
};

export const getRunAvailableSkills = (runState: Readonly<RunState>): readonly SkillConfig[] => {
  const equippedIds = [runState.loadout.weaponId, runState.loadout.subweaponId].filter(
    (equipmentId): equipmentId is string => equipmentId !== null,
  );

  return equippedIds.flatMap((equipmentId) => findEquipment(equipmentId).skills);
};

/** 선택한 보상 종류에 맞는 획득 처리를 고른다. */
export const applyRunReward = (
  runState: Readonly<RunState>,
  reward: Pick<RewardCandidate, "id" | "kind">,
): RunState =>
  reward.kind === "relic"
    ? applyRelicAcquisition(runState, reward.id)
    : applyEquipmentReward(runState, reward.id);

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
  relicIds?: readonly string[];
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
  relicIds,
  mapCompletion,
  onContinue,
}: CreateRunRewardSelectionFlowOptions): RunRewardSelectionFlow => {
  const completionTarget = mapCompletion ?? (nodeId === undefined ? undefined : { nodeId, nextNodeIds });
  const overrides = [
    ...(equipmentIds ?? []).map((id) => toRewardCandidate(findEquipment(id))),
    ...(relicIds ?? []).map((id) => toRelicRewardCandidate(findRelic(id))),
  ];
  const rewards = equipmentIds === undefined && relicIds === undefined
    ? getRewardCandidates(runState, completionTarget?.nodeId ?? nodeId)
    : overrides;
  if (rewards.length === 0) {
    throw new RangeError("At least one reward candidate is required.");
  }

  const adapter = createRewardSelectionAdapter<RunState>({
    initialViewState: createRewardSelectionViewState({
      candidates: rewards,
      round: runState.map.currentRound,
      currency: runState.runCurrency,
    }),
    initialRunState: runState,
    applySelection: (currentRunState, reward) => {
      const rewardedRun = applyRunReward(currentRunState, reward);
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
