import { describe, expect, test } from "bun:test";
import { ENEMY_CONFIGS } from "../src/content/enemies.ts";

const expectedAttackWindups: Readonly<Record<string, number>> = {
  "ink-slime": 7200,
  "hook-tentacle": 5600,
  "iron-beetle": 8000,
  "bell-wraith": 6800,
  "mimic-doll": 7600,
  "reverse-bat": 6000,
  "space-eater": 8400,
  "needle-gunner": 4800,
  "red-scribe": 8000,
  "repair-golem": 8800,
  "explosive-spore": 5600,
  "chain-executor": 7600,
  "mirror-doll": 6400,
  "clock-tick": 5600,
  "ap-devourer": 9200,
  "red-corrector": 6400,
  "inverted-knight": 7200,
  "chorus-conductor": 6000,
  palimpsest: 7600,
  "thousand-beat-chorus": 6000,
  "beat-tentacle": 5600,
};

const expectedExplicitSpecialWindups: Readonly<Record<string, number>> = {
  "palimpsest-word-storm": 9200,
  "palimpsest-red-edit": 10800,
  "thousand-beat-chorus-grand-chorus": 7600,
  "thousand-beat-chorus-crescendo": 9600,
};

describe("enemy windup content values", () => {
  test("stores every normal, elite, boss, and summon attack at its exact 4x value", () => {
    expect(Object.keys(expectedAttackWindups)).toHaveLength(ENEMY_CONFIGS.length);

    for (const enemy of ENEMY_CONFIGS) {
      const attack = enemy.actions.find((action) => action.kind === "attack");

      expect(attack?.windupMs).toBe(expectedAttackWindups[enemy.id]);
    }
  });

  test("stores the default defense windup as 4000ms for every enemy", () => {
    for (const enemy of ENEMY_CONFIGS) {
      const defense = enemy.actions.find((action) => action.kind === "defense");

      expect(defense?.windupMs).toBe(4000);
    }
  });

  test("stores default specials from scaled source values and explicit boss specials at 4x", () => {
    for (const enemy of ENEMY_CONFIGS) {
      const attack = enemy.actions.find((action) => action.kind === "attack");
      const specials = enemy.actions.filter((action) => action.kind === "special");

      expect(attack).toBeDefined();
      expect(specials.length).toBeGreaterThan(0);

      for (const special of specials) {
        const explicitWindup = expectedExplicitSpecialWindups[special.id];

        if (explicitWindup !== undefined) {
          expect(special.windupMs).toBe(explicitWindup);
          continue;
        }

        expect(special.id).toBe(`${enemy.id}-special`);
        expect(special.windupMs).toBe(attack!.windupMs + 1600);
      }
    }
  });
});
