import { describe, expect, test } from "bun:test";
import {
  EFFECT_PLACEHOLDER_TEXTURE_KEY,
  createActorEffectPresentations,
  getEffectDarknessRatio,
  resolveEffectPresentation,
} from "../src/game/hud/effect-presentation";
import { SkillCombatantState } from "../src/game/combat/skill-impact-resolver";

describe("actor effect presentation", () => {
  test("maps known runtime status aliases to provided textures", () => {
    expect(
      resolveEffectPresentation({
        id: "bleed",
        effectId: "bleeding",
        durationMs: 2_000,
        remainingMs: 1_000,
      }).textureKey,
    ).toBe("effect:bleed");
    expect(
      resolveEffectPresentation({
        id: "weaken",
        effectId: "weakness",
        durationMs: 2_000,
        remainingMs: 1_000,
      }).textureKey,
    ).toBe("effect:weaken");
    expect(
      resolveEffectPresentation({
        id: "delay",
        effectId: "delayed_action",
        durationMs: 2_000,
        remainingMs: 1_000,
      }).textureKey,
    ).toBe("effect:enemy-delay");
  });

  test("maps AP regeneration buff and debuff to their actual icons", () => {
    const effects = createActorEffectPresentations({
      apEffects: [
        { id: "up", amountPerSecond: 1, durationMs: 4_000, remainingMs: 3_000 },
        { id: "down", amountPerSecond: -0.5, durationMs: 4_000, remainingMs: 2_000 },
      ],
    });
    expect(effects.map((effect) => effect.textureKey).sort()).toEqual(["effect:ap-regen-down", "effect:ap-regen-up"]);
  });

  test("falls back for unknown effects without throwing", () => {
    expect(
      resolveEffectPresentation({
        id: "unknown",
        effectId: "unknown_effect",
        durationMs: null,
        remainingMs: null,
      }).textureKey,
    ).toBe(EFFECT_PLACEHOLDER_TEXTURE_KEY);
  });

  test("merges same status for one actor, sums stacks and keeps deterministic order", () => {
    const effects = createActorEffectPresentations({
      statuses: [
        { statusId: "weakness", durationMs: 3_000, remainingMs: 2_000, stacks: 1 },
        { statusId: "bleeding", durationMs: 2_000, remainingMs: 1_000, stacks: 2 },
        { statusId: "bleed", durationMs: 4_000, remainingMs: 3_000, stacks: 1 },
      ],
    });
    expect(effects.map((effect) => effect.effectId)).toEqual(["bleed", "weaken"]);
    expect(effects[0]).toMatchObject({ stacks: 3, durationMs: 4_000, remainingMs: 3_000 });
  });

  test("uses shared duration darkness ratios and clamps boundaries", () => {
    expect(getEffectDarknessRatio({ durationMs: 4_000, remainingMs: 4_000 })).toBe(0);
    expect(getEffectDarknessRatio({ durationMs: 4_000, remainingMs: 3_000 })).toBe(0.25);
    expect(getEffectDarknessRatio({ durationMs: 4_000, remainingMs: 2_000 })).toBe(0.5);
    expect(getEffectDarknessRatio({ durationMs: 4_000, remainingMs: 1_000 })).toBe(0.75);
    expect(getEffectDarknessRatio({ durationMs: 4_000, remainingMs: 0 })).toBe(1);
    expect(getEffectDarknessRatio({ durationMs: 4_000, remainingMs: -100 })).toBe(1);
    expect(getEffectDarknessRatio({ durationMs: 4_000, remainingMs: 5_000 })).toBe(0);
    expect(getEffectDarknessRatio({ durationMs: null, remainingMs: null })).toBe(0);
  });
});

describe("status effect lifetime", () => {
  test("tracks remaining time and removes expired effects while preserving legacy duration", () => {
    const combatant = new SkillCombatantState({
      id: "enemy",
      attackPower: 10,
      defense: 0,
      maxHp: 20,
    });
    combatant.applyStatus({
      type: "status",
      statusId: "bleeding",
      durationMs: 1_000,
      stacks: 2,
    });

    combatant.advanceStatuses(250);
    expect(combatant.snapshot.statuses).toEqual([{ statusId: "bleeding", durationMs: 1_000, stacks: 2 }]);
    expect(combatant.timedStatuses).toEqual([{ statusId: "bleeding", durationMs: 1_000, remainingMs: 750, stacks: 2 }]);

    combatant.advanceStatuses(750);
    expect(combatant.snapshot.statuses).toEqual([]);
    expect(combatant.timedStatuses).toEqual([]);
  });
});
