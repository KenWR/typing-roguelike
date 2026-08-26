import { describe, expect, test } from "bun:test";
import {
  createInitialRunState,
  defineSkill,
  ENEMY_CONFIGS,
  EQUIPMENT_CONFIGS,
  type SkillDefinition,
} from "@typing-roguelike/shared";
import { ActionPointResource } from "../src/game/combat/action-point-resource";
import { CombatApEffectController } from "../src/game/combat/combat-ap-effects";
import { CombatState } from "../src/game/combat/combat-state";
import type { CombatEncounterInitialization } from "../src/game/combat/encounter-initializer";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { PlayerCombatRuntime } from "../src/game/combat/player-combat-runtime";

const getEquipment = (equipmentId: string) => {
  const equipment = EQUIPMENT_CONFIGS.find(({ id }) => id === equipmentId);
  if (equipment === undefined) throw new Error(`Missing equipment: ${equipmentId}`);
  return equipment;
};

const inkSlime = ENEMY_CONFIGS.find(({ id }) => id === "ink-slime");
if (inkSlime === undefined) throw new Error("Missing ink-slime config");

const createRuntime = (
  equipmentIds: readonly string[],
  random: () => number = () => 0,
) => {
  const runState = createInitialRunState({ seed: 71, maxHp: 100 });
  const initialization: CombatEncounterInitialization = {
    nodeId: "combat-regression",
    floor: 1,
    nodeType: "combat",
    encounterId: "combat-regression",
    enemies: [{
      instanceId: `${inkSlime.id}:1`,
      enemyId: inkSlime.id,
      name: inkSlime.name,
      hp: inkSlime.hp,
      actions: inkSlime.actions,
    }],
    player: {
      currentHp: runState.character.currentHp,
      maxHp: runState.character.maxHp,
      equipmentIds,
      skills: equipmentIds.flatMap((equipmentId) =>
        getEquipment(equipmentId).skills,
      ),
    },
    rewardPolicy: "standard",
  };
  const combat = new CombatState();
  const enemyTimeline = new EnemyAttackTimeline();
  const runtime = new PlayerCombatRuntime({
    combat,
    enemyTimeline,
    runState,
    initialization,
    random,
  });

  return { combat, enemyTimeline, initialization, runtime };
};

const resolvePlayerSkill = (
  context: ReturnType<typeof createRuntime>,
  skill: SkillDefinition,
  actionId: string,
  targetId = context.initialization.enemies[0]!.instanceId,
): number => {
  const beforeHp = context.runtime.enemyHp[targetId] ?? 0;
  context.combat.startAction({
    id: actionId,
    actorId: "player",
    targetId,
    windupMs: skill.windupMs,
    recoveryMs: skill.recoveryMs,
  });
  context.runtime.registerAction(actionId, skill);
  context.runtime.advance(skill.windupMs + skill.recoveryMs);
  return beforeHp - (context.runtime.enemyHp[targetId] ?? 0);
};

const expectedGuardEffects = {
  equipment_guard_round_shield: [[0.4, 900], [0.5, 1_200]],
  equipment_thorn_shield: [[0.45, 800], [0, 350]],
  equipment_mirror_steel_shield: [[0.5, 800], [0, 350]],
  equipment_fortress_shield: [[0.3, 1_200], [0.2, 2_000]],
  equipment_mobile_wall: [[0.35, 1_000], [0.35, 1_000]],
  equipment_reversal_crest_shield: [[0.4, 800], [0, 350]],
  equipment_bronze_repair_tome: [[0.78, 4_000], [0.78, 2_000]],
  equipment_flame_guard_tome: [[0.82, 4_000], [0, 600]],
  equipment_frost_veil_tome: [[0.8, 4_000], [0, 800]],
  equipment_reflection_grammar: [[0.8, 4_000], [0, 500]],
  equipment_infinite_pages: [[0.85, 4_000], [0.85, 4_000]],
  equipment_final_chapter: [[0.75, 4_000], [0, 1_000]],
} as const;

describe("combat core regressions with production equipment configs", () => {
  test("all 24 shield and tome skills expose their configured guard window", () => {
    const defensiveEquipment = EQUIPMENT_CONFIGS.filter(
      ({ kind }) => kind === "shield" || kind === "tome",
    );
    expect(defensiveEquipment).toHaveLength(12);

    let defenseSkillCount = 0;
    for (const equipment of defensiveEquipment) {
      const expected = expectedGuardEffects[
        equipment.id as keyof typeof expectedGuardEffects
      ];
      expect(expected).toBeDefined();
      expect(equipment.skills).toHaveLength(expected.length);

      equipment.skills.forEach((skillConfig, index) => {
        expect(skillConfig.effects).toHaveLength(1);
        const skill = defineSkill(skillConfig);
        const guards = skill.effects.filter((effect) => effect.type === "guard");
        expect(guards).toHaveLength(1);
        expect(guards[0]).toMatchObject({
          damageMultiplier: expected[index]![0],
          durationMs: expected[index]![1],
        });
        defenseSkillCount += 1;
      });
    }

    expect(defenseSkillCount).toBe(24);
  });

  test("a subweapon without baseAttack does not increase weapon damage", () => {
    const rustySword = getEquipment("equipment_rusty_sword");
    const slash = defineSkill(rustySword.skills[0]!);
    const weaponOnly = createRuntime([rustySword.id]);
    const withShield = createRuntime([
      rustySword.id,
      getEquipment("equipment_guard_round_shield").id,
    ]);

    const weaponOnlyDamage = resolvePlayerSkill(
      weaponOnly,
      slash,
      "weapon-only:slash",
    );
    const withShieldDamage = resolvePlayerSkill(
      withShield,
      slash,
      "with-shield:slash",
    );

    expect(weaponOnlyDamage).toBe(9);
    expect(withShieldDamage).toBe(weaponOnlyDamage);
  });

  test("an actual enemy defense action protects the enemy without hitting the player", () => {
    const rustySword = getEquipment("equipment_rusty_sword");
    const slash = defineSkill(rustySword.skills[0]!);
    const context = createRuntime([rustySword.id], () => 0.4);
    const defense = inkSlime.actions.find(({ kind }) => kind === "defense");
    if (defense === undefined) throw new Error("Ink slime has no defense action");

    context.runtime.start();
    context.runtime.advance(defense.windupMs + defense.recoveryMs);
    expect(context.runtime.playerHp).toBe(100);

    const defendedDamage = resolvePlayerSkill(
      context,
      slash,
      "after-enemy-defense:first",
    );
    const damageAfterDefenseWasConsumed = resolvePlayerSkill(
      context,
      slash,
      "after-enemy-defense:second",
    );

    expect(defendedDamage).toBe(8);
    expect(damageAfterDefenseWasConsumed).toBe(9);
  });

  test("applies an earlier enemy defense before a later player hit in the same frame", () => {
    const rustySword = getEquipment("equipment_rusty_sword");
    const slowSlash = defineSkill({
      ...rustySword.skills[0]!,
      id: "same-frame-slow-slash",
      windupMs: 3_500,
      recoveryMs: 500,
    });
    const context = createRuntime([rustySword.id], () => 0.4);
    const enemyId = context.initialization.enemies[0]!.instanceId;

    context.runtime.start();
    context.combat.startAction({
      id: "same-frame:slash",
      actorId: "player",
      targetId: enemyId,
      windupMs: slowSlash.windupMs,
      recoveryMs: slowSlash.recoveryMs,
    });
    context.runtime.registerAction("same-frame:slash", slowSlash);
    const beforeHp = context.runtime.enemyHp[enemyId]!;

    context.runtime.advance(4_000);

    expect(context.runtime.playerHp).toBe(100);
    expect(beforeHp - context.runtime.enemyHp[enemyId]!).toBe(8);
  });

  test("a discount cannot make an actual positive-cost skill free", () => {
    const meditate = defineSkill({
      id: "regression-meditate",
      name: "명상",
      command: "명상",
      kind: "utility",
      category: "basic",
      apCost: 0,
      windupMs: 0,
      recoveryMs: 0,
      description: "할인을 준비합니다.",
    });
    const oneCostSpecial = defineSkill({
      id: "regression-one-cost-special",
      name: "특수기",
      command: "특수기",
      kind: "attack",
      category: "special",
      apCost: 1,
      windupMs: 0,
      recoveryMs: 0,
      damageCoefficient: 1,
      description: "1 AP 특수기입니다.",
    });
    const controller = new CombatApEffectController({
      actionPoints: new ActionPointResource(),
      relicIds: ["relic_incense_of_meditation"],
    });
    controller.onSkillStarted(meditate, 1);

    expect(controller.resolveSkillCost(oneCostSpecial)).toBe(1);
  });
});
