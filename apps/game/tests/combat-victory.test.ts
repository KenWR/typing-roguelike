import { describe, expect, test } from "bun:test";
import { CombatVictoryResolver } from "../src/game/combat/combat-victory";

describe("combat victory resolver", () => {
  test("wins only after every enemy is dead and emits reward transition once", () => {
    const resolver = new CombatVictoryResolver([
      { enemyId: "slime", maxHp: 10 },
      { enemyId: "bat", maxHp: 5 },
    ]);

    const first = resolver.applyDamage("slime", 10);
    expect(first.snapshot.combat.status).toBe("active");
    expect(first.events).toEqual([]);

    const second = resolver.applyDamage("bat", 5);
    expect(second.snapshot.combat.status).toBe("victory");
    expect(second.snapshot.combat.canAcceptInput).toBe(false);
    expect(second.events).toEqual([{ type: "reward-ready" }]);
  });

  test("rejects additional attack input after victory", () => {
    const resolver = new CombatVictoryResolver([{ enemyId: "slime", maxHp: 1 }]);
    resolver.applyDamage("slime", 1);

    const duplicate = resolver.applyDamage("slime", 1);
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.damage).toBeNull();
    expect(duplicate.events).toEqual([]);
    expect(duplicate.snapshot.enemies.slime?.currentHp).toBe(0);
  });

  test("does not emit victory from a partially damaged final target", () => {
    const resolver = new CombatVictoryResolver([{ enemyId: "elite", maxHp: 20 }]);
    const result = resolver.applyDamage("elite", 19);

    expect(result.accepted).toBe(true);
    expect(result.snapshot.combat.status).toBe("active");
    expect(result.snapshot.combat.canAcceptInput).toBe(true);
    expect(result.events).toEqual([]);
  });

  test("requires at least one unique enemy", () => {
    expect(() => new CombatVictoryResolver([])).toThrow("at least one enemy");
    expect(
      () =>
        new CombatVictoryResolver([
          { enemyId: "same", maxHp: 1 },
          { enemyId: "same", maxHp: 1 },
        ]),
    ).toThrow("Duplicate enemy id");
  });
});
