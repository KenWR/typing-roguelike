import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS, type GeneratedMapNode } from "@typing-roguelike/shared";
import { initializeCombatEncounter } from "../src/game/combat/encounter-initializer";
import { RunSession, ensurePlayableRunLoadout } from "../src/game/run/run-session";

const firstCombatNode: GeneratedMapNode = {
  choice: 1,
  icon: "combat",
  iconType: "combat",
  key: "1-1",
  parentKey: "start",
  nextNodeKeys: ["2-1"],
  round: 1,
  type: "combat",
};

describe("RunSession", () => {
  test("starts a new run with an owned weapon that provides an attack skill", () => {
    const session = new RunSession();
    const run = session.create({ seed: 1 });
    const weapon = EQUIPMENT_CONFIGS.find(({ id }) => id === run.loadout.weaponId);

    expect(run.loadout.weaponId).not.toBeNull();
    expect(run.inventory.itemInstances).toContain(run.loadout.weaponId!);
    expect(weapon?.slot).toBe("weapon");
    expect(weapon?.skills.some((skill) => skill.kind === "attack")).toBe(true);

    const combat = initializeCombatEncounter(run, firstCombatNode);
    expect(combat.ok).toBe(true);
    if (combat.ok) {
      expect(combat.combat.player.skills.some((skill) => skill.kind === "attack")).toBe(true);
    }
  });

  test("repairs an active run whose loadout cannot attack", () => {
    const session = new RunSession();
    const run = session.create({ seed: 2 });
    const repaired = ensurePlayableRunLoadout({
      ...run,
      inventory: { ...run.inventory, itemInstances: [] },
      loadout: {
        weaponId: null,
        subweaponId: null,
        ring1Id: null,
        ring2Id: null,
      },
    });

    expect(repaired.loadout.weaponId).not.toBeNull();
    expect(repaired.inventory.itemInstances).toContain(repaired.loadout.weaponId!);
  });

  test("keeps exactly one active run", () => {
    const session = new RunSession();
    const first = session.create({ seed: 3 });

    expect(session.get()).toBe(first);
    expect(() => session.create({ seed: 4 })).toThrow("An active run already exists.");
  });

  test("updates the same session state across consumers", () => {
    const session = new RunSession();
    session.create({ seed: 5 });

    const updated = session.update((current) => ({
      ...current,
      runCurrency: current.runCurrency + 10,
    }));

    expect(updated.runCurrency).toBe(10);
    expect(session.require().runCurrency).toBe(10);
  });

  test("ends a run and rejects later updates", () => {
    const session = new RunSession();
    session.create({ seed: 6 });
    const ended = session.end("dead");

    expect(ended.status).toBe("dead");
    expect(() => session.update((current) => ({ ...current, runCurrency: 999 }))).toThrow(
      "Finished runs cannot be updated.",
    );
  });

  test("allows a new run after an ended run", () => {
    const session = new RunSession();
    session.create({ seed: 7 });
    session.end("abandoned");

    const next = session.create({ seed: 8 });
    expect(next.map.seed).toBe(8);
    expect(next.status).toBe("active");
  });

  test("can clear the session", () => {
    const session = new RunSession();
    session.create({ seed: 9 });
    session.clear();

    expect(session.get()).toBeNull();
    expect(() => session.require()).toThrow("No run session is active.");
  });
});
