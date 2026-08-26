import {
  ENCOUNTER_CONFIGS,
  ENEMY_CONFIGS,
  EQUIPMENT_CONFIGS,
  resolveSkillsWithRings,
  type EncounterConfig,
  type EnemyActionConfig,
  type GeneratedMapNode,
  type RunState,
  type SkillConfig,
} from "@typing-roguelike/shared";

export type CombatRewardPolicy = "standard" | "elite" | "boss";

export type CombatEnemyInitialization = Readonly<{
  instanceId: string;
  enemyId: string;
  name: string;
  hp: number;
  actions: readonly EnemyActionConfig[];
}>;

export type CombatPlayerInitialization = Readonly<{
  currentHp: number;
  maxHp: number;
  equipmentIds: readonly string[];
  skills: readonly SkillConfig[];
}>;

export type CombatEncounterInitialization = Readonly<{
  nodeId: string;
  floor: number;
  nodeType: Extract<GeneratedMapNode["type"], "combat" | "elite" | "boss">;
  encounterId: string;
  enemies: readonly CombatEnemyInitialization[];
  player: CombatPlayerInitialization;
  rewardPolicy: CombatRewardPolicy;
}>;

export type CombatEntryResult =
  | Readonly<{ ok: true; combat: CombatEncounterInitialization }>
  | Readonly<{
      ok: false;
      reason: "non-combat-node" | "encounter-not-found" | "enemy-not-found";
      recoverTo: "map";
    }>;

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const isCombatNode = (
  node: GeneratedMapNode,
): node is GeneratedMapNode & { type: "combat" | "elite" | "boss" } =>
  node.type === "combat" || node.type === "elite" || node.type === "boss";

const chooseEncounter = (
  runState: Readonly<RunState>,
  node: GeneratedMapNode & { type: "combat" | "elite" | "boss" },
): EncounterConfig | undefined => {
  const candidates = ENCOUNTER_CONFIGS.filter(
    (encounter) => encounter.floor === node.round && encounter.nodeType === node.type,
  );
  if (candidates.length === 0) return undefined;

  if (node.monsterId !== undefined) {
    const matchingMonster = candidates.find((encounter) =>
      encounter.members.some((member) => member.enemyId === node.monsterId),
    );
    if (matchingMonster !== undefined) return matchingMonster;
  }

  return candidates[hash(`${runState.map.seed}:${node.key}`) % candidates.length];
};

const getEquippedIds = (runState: Readonly<RunState>): string[] =>
  [runState.loadout.weaponId, runState.loadout.subweaponId].filter(
    (equipmentId): equipmentId is string => equipmentId !== null,
  );

const getEquippedSkills = (
  runState: Readonly<RunState>,
  equipmentIds: readonly string[],
): SkillConfig[] => {
  const baseSkills = equipmentIds.flatMap(
    (equipmentId) =>
      EQUIPMENT_CONFIGS.find((equipment) => equipment.id === equipmentId)?.skills ?? [],
  );
  return resolveSkillsWithRings(baseSkills, [
    runState.loadout.ring1Id,
    runState.loadout.ring2Id,
  ]).map(({ skill }) => skill);
};

const getRewardPolicy = (
  nodeType: CombatEncounterInitialization["nodeType"],
): CombatRewardPolicy =>
  nodeType === "elite" ? "elite" : nodeType === "boss" ? "boss" : "standard";

export const initializeCombatEncounter = (
  runState: Readonly<RunState>,
  node: GeneratedMapNode,
): CombatEntryResult => {
  if (!isCombatNode(node)) {
    return { ok: false, reason: "non-combat-node", recoverTo: "map" };
  }

  const encounter = chooseEncounter(runState, node);
  if (encounter === undefined) {
    return { ok: false, reason: "encounter-not-found", recoverTo: "map" };
  }

  const enemies: CombatEnemyInitialization[] = [];
  for (const member of encounter.members) {
    const config = ENEMY_CONFIGS.find((enemy) => enemy.id === member.enemyId);
    if (config === undefined) {
      return { ok: false, reason: "enemy-not-found", recoverTo: "map" };
    }

    for (let index = 0; index < member.count; index += 1) {
      enemies.push({
        instanceId: `${member.enemyId}:${index + 1}`,
        enemyId: config.id,
        name: config.name,
        hp: config.hp,
        actions: config.actions,
      });
    }
  }

  const equipmentIds = getEquippedIds(runState);
  return {
    ok: true,
    combat: {
      nodeId: node.key,
      floor: node.round,
      nodeType: node.type,
      encounterId: encounter.id,
      enemies,
      player: {
        currentHp: runState.character.currentHp,
        maxHp: runState.character.maxHp,
        equipmentIds,
        skills: getEquippedSkills(runState, equipmentIds),
      },
      rewardPolicy: getRewardPolicy(node.type),
    },
  };
};
