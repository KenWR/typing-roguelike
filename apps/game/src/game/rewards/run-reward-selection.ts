import {
  EQUIPMENT_CONFIGS,
  RELIC_CONFIGS,
  RING_CONFIGS,
  applyRelicAcquisition,
  applyEquipmentAcquisition,
  applyRingAcquisition,
  completeMapNode,
  generateEquipmentRewardCandidates,
  generateRelicRewardCandidates,
  generateRingRewardCandidates,
  resolveSkillsWithRings,
  type EquipmentConfig,
  type EquipmentRewardTier,
  type RelicConfig,
  type RingConfig,
  type RunState,
  type SkillConfig,
} from "@typing-roguelike/shared";
import { getRelicIconTextureKey } from "../assets/asset-catalog";
import { resolveEquipmentIconTextureKey } from "../assets/equipment-icon-assets";
import { resolveRingIconTextureKey } from "../assets/ring-icon-assets";
import { formatEquipmentSkillDetails, getEquipmentHandLabel } from "../equipment/equipment-info";
import { SCENE_KEYS } from "../scenes/scene-contract";
import {
  createRewardSelectionAdapter,
  type RewardSelectionAdapter,
  type RingReplacementOption,
} from "./reward-selection-adapter";
import { createRewardSelectionViewState, type RewardCandidate, type RewardRarity } from "./reward-selection-view-state";

/** 보상 후보 칸 수. 기본 보상에는 유물 두 개를 항상 포함한다. */
const REWARD_CANDIDATE_COUNT = 3;
const MIN_RELIC_REWARD_COUNT = 2;
const RING_REWARD_CHANCE = 1 / 3;

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

const findRing = (ringId: string): RingConfig => {
  const ring = RING_CONFIGS.find((candidate) => candidate.id === ringId);
  if (ring === undefined) {
    throw new Error(`Unknown ring reward: ${ringId}`);
  }
  return ring;
};

const toRelicRewardCandidate = (relic: RelicConfig): RewardCandidate => ({
  id: relic.id,
  kind: "relic",
  name: relic.name,
  rarity: toRewardRarity(relic.rarity),
  description: relic.description,
  effect: "유물 · 획득 시 바로 장착",
  icon: "◈",
  imageKey: getRelicIconTextureKey(relic.id),
});

const toRingRewardCandidate = (ring: RingConfig): RewardCandidate => ({
  id: ring.id,
  kind: "ring",
  name: ring.name,
  imageKey: resolveRingIconTextureKey(ring.id),
  rarity: toRewardRarity(ring.rarity),
  description: ring.description,
  effect: `${ring.position === "prefix" ? "접두사" : "접미사"} · ${ring.commandAffix}`,
  icon: "◌",
});

const toRewardCandidate = (equipment: EquipmentConfig): RewardCandidate => ({
  id: equipment.id,
  kind: "weapon",
  name: equipment.name,
  rarity: toRewardRarity(equipment.rarity),
  description: `${getEquipmentHandLabel(equipment)} · ${equipment.kind}`,
  effect: `공격 ${equipment.baseAttack ?? 0} · 사용 스킬 ${equipment.skills.length}개`,
  details: formatEquipmentSkillDetails(equipment),
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

/** 같은 seed/node에서 결정적인 장비·유물·반지 혼합 보상을 만든다. */
const getRewardCandidates = (
  runState: Readonly<RunState>,
  nodeId: string | undefined,
  randomOverride?: () => number,
  equipmentTier: EquipmentRewardTier = "normal",
  rewardCount = REWARD_CANDIDATE_COUNT,
): readonly RewardCandidate[] => {
  if (!Number.isSafeInteger(rewardCount) || rewardCount < 0) {
    throw new RangeError(`Reward candidate count must be a non-negative integer: ${rewardCount}`);
  }
  const candidateCount = Math.max(MIN_RELIC_REWARD_COUNT, rewardCount);
  const random =
    randomOverride ?? createSeededRandom(runState.map.seed ^ hashString(nodeId ?? runState.map.currentNodeId));

  const remainingSlots = candidateCount - MIN_RELIC_REWARD_COUNT;
  const ringCount = remainingSlots > 0 && random() < RING_REWARD_CHANCE ? 1 : 0;

  const rings = generateRingRewardCandidates({
    count: ringCount,
    random,
    excludedRingIds: runState.inventory.itemInstances,
  });
  const relics = generateRelicRewardCandidates({
    count: MIN_RELIC_REWARD_COUNT,
    random,
    excludedRelicIds: runState.inventory.relicInstances,
  });
  const equipment = generateEquipmentRewardCandidates({
    tier: equipmentTier,
    count: Math.max(0, remainingSlots - rings.length),
    random,
    excludedEquipmentIds: runState.inventory.itemInstances,
  });

  return [
    ...equipment.map(toRewardCandidate),
    ...rings.map(toRingRewardCandidate),
    ...relics.map(toRelicRewardCandidate),
  ];
};

export const getRunAvailableSkills = (runState: Readonly<RunState>): readonly SkillConfig[] => {
  const equippedIds = [runState.loadout.weaponId, runState.loadout.subweaponId].filter(
    (equipmentId): equipmentId is string => equipmentId !== null,
  );
  const baseSkills = equippedIds.flatMap((equipmentId) => findEquipment(equipmentId).skills);
  return resolveSkillsWithRings(baseSkills, [runState.loadout.ring1Id, runState.loadout.ring2Id]).map(
    ({ skill }) => skill,
  );
};

/** 선택한 보상 종류에 맞는 획득 처리를 고른다. */
export const applyRunReward = (
  runState: Readonly<RunState>,
  reward: Pick<RewardCandidate, "id" | "kind">,
  replacementRingId?: string | null,
): RunState => {
  if (reward.kind === "relic") return applyRelicAcquisition(runState, reward.id);
  if (reward.kind === "ring") return applyRingAcquisition(runState, reward.id, { replaceRingId: replacementRingId });
  return applyEquipmentReward(runState, reward.id);
};

export const applyEquipmentReward = (runState: Readonly<RunState>, equipmentId: string): RunState => {
  const equipment = findEquipment(equipmentId);
  return applyEquipmentAcquisition(runState, equipment);
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
  ringIds?: readonly string[];
  equipmentTier?: EquipmentRewardTier;
  rewardCount?: number;
  random?: () => number;
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
  ringIds,
  equipmentTier = "normal",
  rewardCount = REWARD_CANDIDATE_COUNT,
  random,
  mapCompletion,
  onContinue,
}: CreateRunRewardSelectionFlowOptions): RunRewardSelectionFlow => {
  const completionTarget = mapCompletion ?? (nodeId === undefined ? undefined : { nodeId, nextNodeIds });
  const overrides = [
    ...(equipmentIds ?? []).map((id) => toRewardCandidate(findEquipment(id))),
    ...(ringIds ?? []).map((id) => toRingRewardCandidate(findRing(id))),
    ...(relicIds ?? []).map((id) => toRelicRewardCandidate(findRelic(id))),
  ];
  const rewards =
    equipmentIds === undefined && relicIds === undefined && ringIds === undefined
      ? getRewardCandidates(runState, completionTarget?.nodeId ?? nodeId, random, equipmentTier, rewardCount)
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
    applySelection: (currentRunState, reward, replacementRingId) => {
      const rewardedRun = applyRunReward(currentRunState, reward, replacementRingId);
      if (completionTarget === undefined) return rewardedRun;

      const completion = completeMapNode(rewardedRun.map, completionTarget.nodeId, completionTarget.nextNodeIds);
      return completion.applied ? { ...rewardedRun, map: completion.map } : rewardedRun;
    },
    getRingReplacementOptions: (currentRunState, reward): readonly RingReplacementOption[] => {
      if (reward.kind !== "ring") return [];
      const equippedRingIds = [currentRunState.loadout.ring1Id, currentRunState.loadout.ring2Id].filter(
        (id): id is string => id !== null,
      );
      if (equippedRingIds.length < 2) return [];
      return equippedRingIds.map((id) => ({ id, name: findRing(id).name }));
    },
    onContinue: (completedRunState) => onContinue?.(completedRunState),
  });

  return {
    adapter,
    nextSceneKey: SCENE_KEYS.map,
    getAvailableSkills: () => getRunAvailableSkills(adapter.getRunState()),
  };
};
