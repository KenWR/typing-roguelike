/* biome-ignore-all lint/style/noNonNullAssertion: production fixture arrays are asserted by the test setup. */
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

const createRuntime = (equipmentIds: readonly string[], random: () => number = () => 0) => {
  const runState = createInitialRunState({ seed: 71, maxHp: 100 });
  const initialization: CombatEncounterInitialization = {
    nodeId: "combat-regression",
    floor: 1,
    nodeType: "combat",
    encounterId: "combat-regression",
    enemies: [
      {
        instanceId: `${inkSlime.id}:1`,
        enemyId: inkSlime.id,
        name: inkSlime.name,
        hp: inkSlime.hp,
        actions: inkSlime.actions,
      },
    ],
    player: {
      currentHp: runState.character.currentHp,
      maxHp: runState.character.maxHp,
      equipmentIds,
      skills: equipmentIds.flatMap((equipmentId) => getEquipment(equipmentId).skills),
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

const expectedShieldEffects = {
  equipment_guard_round_shield: [
    [24, 900],
    [30, 1_200],
  ],
  equipment_thorn_shield: [
    [22, 800],
    [45, 350],
  ],
  equipment_mirror_steel_shield: [
    [20, 800],
    [50, 350],
  ],
  equipment_fortress_shield: [
    [28, 1_200],
    [40, 2_000],
  ],
  equipment_mobile_wall: [
    [26, 1_000],
    [32, 1_000],
  ],
  equipment_reversal_crest_shield: [
    [22, 800],
    [48, 350],
  ],
  equipment_bronze_repair_tome: [
    [22, 4_000],
    [11, 6_000],
  ],
  equipment_flame_guard_tome: [
    [18, 4_000],
    [40, 600],
  ],
  equipment_frost_veil_tome: [
    [20, 4_000],
    [45, 800],
  ],
  equipment_reflection_grammar: [
    [18, 4_000],
    [42, 500],
  ],
  equipment_infinite_pages: [
    [15, 4_000],
    [22, 4_000],
  ],
  equipment_final_chapter: [
    [25, 4_000],
    [55, 1_000],
  ],
} as const;

describe("combat core regressions with production equipment configs", () => {
  test("all 24 shield and tome skills expose their configured shield", () => {
    const defensiveEquipment = EQUIPMENT_CONFIGS.filter(({ kind }) => kind === "shield" || kind === "tome");
    expect(defensiveEquipment).toHaveLength(12);

    let defenseSkillCount = 0;
    for (const equipment of defensiveEquipment) {
      const expected = expectedShieldEffects[equipment.id as keyof typeof expectedShieldEffects];
      expect(expected).toBeDefined();
      expect(equipment.skills).toHaveLength(expected.length);

      equipment.skills.forEach((skillConfig, index) => {
        const skill = defineSkill(skillConfig);
        const shields = skill.effects.filter((effect) => effect.type === "shield");
        expect(shields).toHaveLength(1);
        expect(shields[0]).toMatchObject({
          amount: expected[index]![0],
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
    const withShield = createRuntime([rustySword.id, getEquipment("equipment_guard_round_shield").id]);

    const weaponOnlyDamage = resolvePlayerSkill(weaponOnly, slash, "weapon-only:slash");
    const withShieldDamage = resolvePlayerSkill(withShield, slash, "with-shield:slash");

    expect(weaponOnlyDamage).toBe(9);
    expect(withShieldDamage).toBe(weaponOnlyDamage);
  });

  test("an enemy shield absorbs hits during its windup and is gone once the windup ends", () => {
    const rustySword = getEquipment("equipment_rusty_sword");
    const slash = defineSkill(rustySword.skills[0]!);
    const context = createRuntime([rustySword.id], () => 0.4);
    const enemyId = context.initialization.enemies[0]!.instanceId;
    const defense = inkSlime.actions.find(({ kind }) => kind === "defense");
    if (defense === undefined) throw new Error("Ink slime has no defense action");

    context.runtime.start();
    expect(context.runtime.enemyShield[enemyId]).toBe(defense.shieldAmount);

    const shieldedDamage = resolvePlayerSkill(context, slash, "during-enemy-windup");
    expect(shieldedDamage).toBe(0);
    expect(context.runtime.enemyShield[enemyId]).toBe((defense.shieldAmount ?? 0) - 9);

    // 선딜이 끝나면 남은 실드도 함께 사라지고 후딜 동안 그대로 맞습니다.
    context.runtime.advance(defense.windupMs - 200);
    expect(context.runtime.enemyShield[enemyId]).toBe(0);

    const punishDamage = resolvePlayerSkill(context, slash, "after-enemy-windup");

    expect(punishDamage).toBe(9);
    expect(context.runtime.playerHp).toBe(100);
  });

  test("removes a defense shield at the exact cast-completed frame", () => {
    const context = createRuntime([getEquipment("equipment_rusty_sword").id], () => 0.4);
    const enemyId = context.initialization.enemies[0]!.instanceId;
    const defense = inkSlime.actions.find(({ kind }) => kind === "defense");
    if (defense === undefined) throw new Error("Ink slime has no defense action");

    context.runtime.start();
    expect(context.runtime.enemyShield[enemyId]).toBe(defense.shieldAmount);
    const update = context.runtime.advance(defense.windupMs);

    expect(update.enemyTimeline.snapshot.attacks[0]?.phase).toBe("recovery");
    expect(update.enemyShield[enemyId]).toBe(0);
  });

  test("does not keep a defense shield after its windup action is removed", () => {
    const context = createRuntime([getEquipment("equipment_rusty_sword").id], () => 0.4);
    const enemyId = context.initialization.enemies[0]!.instanceId;

    context.runtime.start();
    const timelineId = context.enemyTimeline.snapshot.attacks[0]?.timelineId;
    if (timelineId === undefined) throw new Error("Expected a defense timeline");
    expect(context.runtime.enemyShield[enemyId]).toBeGreaterThan(0);

    // A canceled windup has no cast-completed event in the next runtime update.
    // The shield must still be removed from the phase snapshot instead of being
    // reset or left active until its old duration expires.
    expect(context.enemyTimeline.cancelAttack(timelineId)).toBe(true);
    context.runtime.advance(0);

    expect(context.runtime.enemyShield[enemyId]).toBe(0);
  });

  test("does not create a shield during an attack windup", () => {
    const rustySword = getEquipment("equipment_rusty_sword");
    const slash = defineSkill(rustySword.skills[0]!);
    const context = createRuntime([rustySword.id], () => 0);
    const enemyId = context.initialization.enemies[0]!.instanceId;
    const attack = inkSlime.actions.find(({ kind }) => kind === "attack");
    if (attack === undefined) throw new Error("Ink slime has no attack action");

    context.runtime.start();
    expect(attack.shieldAmount).toBeUndefined();
    expect(context.runtime.enemyShield[enemyId]).toBe(0);

    resolvePlayerSkill(context, slash, "break:first");
    resolvePlayerSkill(context, slash, "break:second");
    const beforeHp = context.runtime.enemyHp[enemyId]!;
    resolvePlayerSkill(context, slash, "break:third");

    // 22 실드를 9+9+4로 깎아 내고 남은 5만 체력으로 넘어갑니다.
    expect(beforeHp - context.runtime.enemyHp[enemyId]!).toBe(9);
    // 취소된 즉시 다음 행동이 시작되므로 실드는 다시 가득 찹니다.
    expect(context.runtime.enemyShield[enemyId]).toBe(0);

    // 세 번의 타격으로 0.9초가 지났으므로 4.8초를 더 흘리면 원래 공격이
    // 적중했어야 할 5.7초에 닿습니다. 취소된 공격은 끝내 들어오지 않습니다.
    context.runtime.advance(4_800);
    expect(context.runtime.playerHp).toBe(93);
  });

  test("gives a same-frame enemy action its shield before a later player hit lands", () => {
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
    // 3.5초에 시작된 다음 방어의 실드가 4초 타격을 전부 받아냅니다.
    expect(beforeHp - context.runtime.enemyHp[enemyId]!).toBe(0);
    expect(context.runtime.enemyShield[enemyId]).toBe(30 - 9);
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
