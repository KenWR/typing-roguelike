import { describe, expect, test } from "bun:test";
import {
  createInitialRunState,
  defineSkill,
  ENEMY_CONFIGS,
  EQUIPMENT_CONFIGS,
  type SkillDefinition,
} from "@typing-roguelike/shared";
import { CombatState } from "../src/game/combat/combat-state";
import type { CombatEncounterInitialization } from "../src/game/combat/encounter-initializer";
import { EnemyAttackTimeline } from "../src/game/combat/enemy-attack-timeline";
import { PlayerCombatRuntime } from "../src/game/combat/player-combat-runtime";

const requireValue = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`Missing ${label}`);
  return value;
};

const inkSlime = requireValue(
  ENEMY_CONFIGS.find(({ id }) => id === "ink-slime"),
  "ink slime config",
);
const rustySword = requireValue(
  EQUIPMENT_CONFIGS.find(({ id }) => id === "equipment_rusty_sword"),
  "rusty sword config",
);

const createRuntime = () => {
  const runState = createInitialRunState({ seed: 71, maxHp: 100 });
  const initialization: CombatEncounterInitialization = {
    nodeId: "shield-timing",
    floor: 1,
    nodeType: "combat",
    encounterId: "shield-timing",
    enemies: [
      {
        instanceId: "ink-slime:1",
        enemyId: inkSlime.id,
        name: inkSlime.name,
        hp: inkSlime.hp,
        actions: inkSlime.actions,
      },
    ],
    player: {
      currentHp: runState.character.currentHp,
      maxHp: runState.character.maxHp,
      equipmentIds: [rustySword.id],
      skills: rustySword.skills,
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
    random: () => 0.4,
  });

  return { combat, enemyTimeline, initialization, runtime };
};

describe("enemy defense shield timing", () => {
  test("keeps the shield for an impact before defense cast completion", () => {
    const context = createRuntime();
    const enemy = requireValue(context.initialization.enemies[0], "enemy");
    const defense = requireValue(
      inkSlime.actions.find(({ kind }) => kind === "defense"),
      "defense action",
    );
    const sourceSkillConfig = requireValue(rustySword.skills[0], "sword skill");
    const skill: SkillDefinition = defineSkill({
      ...sourceSkillConfig,
      id: "shield-timing-slash",
      windupMs: 1_000,
      recoveryMs: 500,
    });

    context.runtime.start();
    const beforeHp = context.runtime.enemyHp[enemy.instanceId];
    context.combat.startAction({
      id: "shield-timing:slash",
      actorId: "player",
      targetId: enemy.instanceId,
      windupMs: skill.windupMs,
      recoveryMs: skill.recoveryMs,
    });
    context.runtime.registerAction("shield-timing:slash", skill);
    context.runtime.advance(2_000);

    expect(context.runtime.enemyHp[enemy.instanceId]).toBe(beforeHp);
    expect(context.runtime.enemyShield[enemy.instanceId]).toBe((defense.shieldAmount ?? 0) - 9);
    expect(context.enemyTimeline.snapshot.attacks[0]?.phase).toBe("windup");
  });
});
