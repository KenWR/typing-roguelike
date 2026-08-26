import {
  EQUIPMENT_CONFIGS,
  completeMapNode,
  type EquipmentConfig,
  type RunState,
  type SkillConfig,
} from "@typing-roguelike/shared";
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
  equipmentIds?: readonly string[];
  mapCompletion?: Readonly<{
    nodeId: string;
    nextNodeIds: readonly string[];
  }>;
}>;

export const createRunRewardSelectionFlow = ({
  runState,
  equipmentIds = EQUIPMENT_CONFIGS.filter((equipment) => equipment.rarity !== "hidden")
    .slice(0, 3)
    .map((equipment) => equipment.id),
  mapCompletion,
}: CreateRunRewardSelectionFlowOptions): RunRewardSelectionFlow => {
  const equipmentRewards = equipmentIds.map(findEquipment);
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
      const rewardedRunState = applyEquipmentReward(currentRunState, reward.id);
      if (mapCompletion === undefined) {
        return rewardedRunState;
      }
      const completion = completeMapNode(
        rewardedRunState.map,
        mapCompletion.nodeId,
        mapCompletion.nextNodeIds,
      );
      return { ...rewardedRunState, map: completion.map };
    },
  });

  return {
    adapter,
    nextSceneKey: SCENE_KEYS.map,
    getAvailableSkills: () => getRunAvailableSkills(adapter.getRunState()),
  };
};
