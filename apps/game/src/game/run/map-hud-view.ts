import {
  EQUIPMENT_CONFIGS,
  START_NODE_KEY,
  generateMap,
  getMapNodeKey,
  type MapNodeIconType,
  type MapNodeStatus,
  type RunState,
} from "@typing-roguelike/shared";

export type MapHudNodeView = Readonly<{
  id: string;
  type: string;
  iconType: MapNodeIconType;
  status: MapNodeStatus;
  round: number;
  choice: number;
  nextNodeIds: readonly string[];
}>;

export type MapHudView = Readonly<{
  floor: number;
  hpText: string;
  currencyText: string;
  equipmentText: string;
  currentLocation: string;
  pathText: string;
  nodes: readonly MapHudNodeView[];
}>;

const equipmentNameById = new Map(
  EQUIPMENT_CONFIGS.map((equipment) => [equipment.id, equipment.name] as const),
);

const equipmentSummary = (runState: Readonly<RunState>): string => {
  const equipped = [
    runState.loadout.weaponId,
    runState.loadout.subweaponId,
    runState.loadout.ring1Id,
    runState.loadout.ring2Id,
  ].filter((id): id is string => id !== null);

  if (equipped.length === 0) return "장비 없음";

  return equipped
    .map((id) => equipmentNameById.get(id) ?? "알 수 없는 장비")
    .join(" · ");
};

const buildPath = (runState: Readonly<RunState>): string[] => {
  const path = [START_NODE_KEY];
  for (let round = 1; round <= runState.map.choicePath.length; round += 1) {
    path.push(getMapNodeKey(round, runState.map.choicePath.slice(0, round)));
  }

  if (
    runState.map.currentNodeId !== START_NODE_KEY &&
    path[path.length - 1] !== runState.map.currentNodeId
  ) {
    path.push(runState.map.currentNodeId);
  }
  return path;
};

export const createMapHudView = (runState: Readonly<RunState>): MapHudView => {
  const nodes = generateMap(runState.map.seed).rounds.flatMap(({ nodes: roundNodes }) =>
    roundNodes.map((node) => ({
      id: node.key,
      type: node.type,
      iconType: node.iconType,
      status: runState.map.nodeStatuses[node.key] ?? "locked",
      round: node.round,
      choice: node.choice,
      nextNodeIds: node.nextNodeKeys,
    })),
  );

  const path = buildPath(runState);
  return {
    floor: runState.map.currentRound,
    hpText: `${runState.character.currentHp} / ${runState.character.maxHp}`,
    currencyText: `${runState.runCurrency}`,
    equipmentText: equipmentSummary(runState),
    currentLocation: runState.map.currentNodeId,
    pathText: path.join(" → "),
    nodes,
  };
};
