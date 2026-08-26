import {
  START_NODE_KEY,
  generateNodeChoices,
  getMapNodeKey,
  type MapNodeStatus,
  type RunState,
} from "@typing-roguelike/shared";

export type MapHudNodeView = Readonly<{
  id: string;
  type: string;
  status: MapNodeStatus;
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

const equipmentSummary = (runState: Readonly<RunState>): string => {
  const equipped = [
    runState.loadout.weaponId,
    runState.loadout.subweaponId,
    runState.loadout.ring1Id,
    runState.loadout.ring2Id,
  ].filter((id): id is string => id !== null);

  return equipped.length === 0 ? "장비 없음" : equipped.join(" · ");
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
  const nodes = generateNodeChoices(
    runState.map.seed,
    runState.map.currentRound,
    runState.map.choicePath,
  ).map((node) => ({
    id: node.key,
    type: node.type,
    status: runState.map.nodeStatuses[node.key] ?? "locked",
  }));

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
