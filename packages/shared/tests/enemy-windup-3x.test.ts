import { describe, expect, test } from "bun:test";
import { ENEMY_CONFIGS } from "../src/content/enemies.ts";

const expectedAttackWindups: Readonly<Record<string, number>> = {
  "ink-slime": 5400,
  "hook-tentacle": 4200,
  "iron-beetle": 6000,
  "bell-wraith": 5100,
  "mimic-doll": 5700,
  "reverse-bat": 4500,
  "space-eater": 6300,
  "needle-gunner": 3600,
  "red-scribe": 6000,
  "repair-golem": 6600,
  "explosive-spore": 4200,
  "chain-executor": 5700,
  "mirror-doll": 4800,
  "clock-tick": 4200,
  "ap-devourer": 6900,
  "red-corrector": 4800,
  "inverted-knight": 5400,
  "chorus-conductor": 4500,
  palimpsest: 5700,
  "thousand-beat-chorus": 4500,
  "beat-tentacle": 4200,
};

const expectedExplicitSpecialWindups: Readonly<Record<string, number>> = {
  "palimpsest-word-storm": 6900,
  "palimpsest-red-edit": 8100,
  "thousand-beat-chorus-grand-chorus": 5700,
  "thousand-beat-chorus-crescendo": 7200,
};

describe("enemy windup 3x balance", () => {
  test("stores 3x attack windups directly in enemy content", () => {
    for (const enemy of ENEMY_CONFIGS) {
      const attack = enemy.actions.find((action) => action.kind === "attack");
      expect(attack?.windupMs).toBe(expectedAttackWindups[enemy.id]);
    }
  });

  test("stores 3x defense and special windups without a runtime multiplier", () => {
    for (const enemy of ENEMY_CONFIGS) {
      const defense = enemy.actions.find((action) => action.kind === "defense");
      expect(defense?.windupMs).toBe(3000);

      for (const special of enemy.actions.filter((action) => action.kind === "special")) {
        const explicit = expectedExplicitSpecialWindups[special.id];
        if (explicit !== undefined) {
          expect(special.windupMs).toBe(explicit);
        } else {
          expect(special.windupMs).toBe(expectedAttackWindups[enemy.id]! + 1200);
        }
      }
    }
  });
});
