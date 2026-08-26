import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
  type GeneratedMapNode,
} from "@typing-roguelike/shared";
import { initializeCombatEncounter } from "../src/game/combat/encounter-initializer";

const createNode = (
  round: number,
  type: GeneratedMapNode["type"],
  key = `${round}-1`,
): GeneratedMapNode => ({
  choice: 1,
  icon: type,
  iconType: type,
  key,
  parentKey: round === 1 ? "start" : `${round - 1}-1`,
  nextNodeKeys: round === 10 ? [] : [`${round + 1}-1`],
  round,
  type,
});

describe("combat encounter initializer", () => {
  test("selects a matching normal encounter and carries player HP", () => {
    const runState = createInitialRunState({ seed: 42, maxHp: 120, initialHp: 73 });
    const result = initializeCombatEncounter(runState, createNode(1, "combat"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.combat.floor).toBe(1);
    expect(result.combat.nodeType).toBe("combat");
    expect(result.combat.encounterId.startsWith("floor-1-")).toBe(true);
    expect(result.combat.enemies.length).toBeGreaterThan(0);
    expect(result.combat.player.currentHp).toBe(73);
    expect(result.combat.player.maxHp).toBe(120);
    expect(result.combat.rewardPolicy).toBe("standard");
  });

  test("resolves equipped weapon skills from RunState", () => {
    const equipment = EQUIPMENT_CONFIGS[0]!;
    const runState = createInitialRunState({ seed: 7 });
    runState.loadout.weaponId = equipment.id;

    const result = initializeCombatEncounter(runState, createNode(1, "combat"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.combat.player.equipmentIds).toEqual([equipment.id]);
    expect(result.combat.player.skills.map((skill) => skill.id)).toEqual(
      equipment.skills.map((skill) => skill.id),
    );
  });

  test("uses elite and boss reward policies with matching encounters", () => {
    const runState = createInitialRunState({ seed: 11 });
    const elite = initializeCombatEncounter(runState, createNode(4, "elite", "4-1-1-1-1"));
    const boss = initializeCombatEncounter(
      runState,
      createNode(10, "boss", "10-1-1-1-1-1-1-1-1-1-1"),
    );

    expect(elite.ok).toBe(true);
    expect(boss.ok).toBe(true);
    if (elite.ok) {
      expect(elite.combat.encounterId).toBe("floor-4-elite");
      expect(elite.combat.rewardPolicy).toBe("elite");
    }
    if (boss.ok) {
      expect(boss.combat.encounterId).toBe("floor-10-boss");
      expect(boss.combat.rewardPolicy).toBe("boss");
    }
  });

  test("recovers non-combat or missing encounter nodes to map", () => {
    const runState = createInitialRunState({ seed: 1 });

    expect(initializeCombatEncounter(runState, createNode(1, "shop"))).toEqual({
      ok: false,
      reason: "non-combat-node",
      recoverTo: "map",
    });
    expect(initializeCombatEncounter(runState, createNode(2, "elite", "2-1-1"))).toEqual({
      ok: false,
      reason: "encounter-not-found",
      recoverTo: "map",
    });
  });
});
