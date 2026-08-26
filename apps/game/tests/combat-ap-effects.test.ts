import { describe, expect, test } from "bun:test";
import { defineSkill } from "@typing-roguelike/shared";
import { ActionPointResource } from "../src/game/combat/action-point-resource";
import { CombatApEffectController } from "../src/game/combat/combat-ap-effects";

const skill = (overrides: Partial<Parameters<typeof defineSkill>[0]> = {}) => defineSkill({
  id: "skill.test",
  name: "테스트",
  command: "테스트",
  kind: "attack",
  category: "basic",
  apCost: 2,
  windupMs: 0,
  recoveryMs: 0,
  description: "테스트",
  ...overrides,
});

describe("CombatApEffectController", () => {
  test("applies immediate equipment AP recovery descriptions", () => {
    const actionPoints = new ActionPointResource({ initialAp: 1 });
    const effects = new CombatApEffectController({ actionPoints });
    const recovered = skill({
      id: "orb-meditate",
      name: "명상",
      command: "명상",
      kind: "utility",
      effect: "AP 2 회복, 선딜 0.75초",
    });

    expect(effects.onSkillImpact(recovered)).toBe(2);
    expect(actionPoints.snapshot.currentAp).toBe(3);
  });

  test("does not turn conditional AP text into an unconditional gain", () => {
    const actionPoints = new ActionPointResource({ initialAp: 1 });
    const effects = new CombatApEffectController({ actionPoints });
    const conditional = skill({ effect: "보호막 제거 성공 시 AP 1 회복" });

    expect(effects.onSkillImpact(conditional)).toBe(0);
    expect(actionPoints.snapshot.currentAp).toBe(1);
  });

  test("applies relic AP cost increases", () => {
    const actionPoints = new ActionPointResource();
    const effects = new CombatApEffectController({
      actionPoints,
      relicIds: ["relic_fire_scroll", "relic_old_shield", "relic_heavy_greatsword"],
    });

    expect(effects.resolveSkillCost(skill({ category: "special" }))).toBe(3);
    expect(effects.resolveSkillCost(skill({ category: "guard", kind: "defense" }))).toBe(3);
    expect(effects.resolveSkillCost(skill({ name: "휘두르기", command: "휘두르기" }))).toBe(3);
  });

  test("meditation incense discounts the next special exactly once", () => {
    const actionPoints = new ActionPointResource();
    const effects = new CombatApEffectController({ actionPoints, relicIds: ["relic_incense_of_meditation"] });
    const meditate = skill({ name: "명상", command: "명상", kind: "utility", apCost: 0 });
    const special = skill({ id: "special", name: "특수", command: "특수", category: "special", apCost: 3 });

    effects.onSkillStarted(meditate, 1);
    expect(effects.resolveSkillCost(special)).toBe(2);
    effects.onSkillStarted(special, 2);
    expect(effects.resolveSkillCost(special)).toBe(3);
  });

  test("broken metronome adds 0.5 AP regeneration for three seconds", () => {
    const actionPoints = new ActionPointResource({ initialAp: 0 });
    const effects = new CombatApEffectController({ actionPoints, relicIds: ["relic_broken_metronome"] });

    effects.onSkillStarted(skill(), 3);
    expect(actionPoints.snapshot.regenerationPerSecond).toBe(1.5);
    actionPoints.advance(3_000);
    expect(actionPoints.snapshot.currentAp).toBe(4.5);
    expect(actionPoints.snapshot.regenerationPerSecond).toBe(1);
  });

  test("hungry grip can restore AP on melee skill impact", () => {
    const actionPoints = new ActionPointResource({ initialAp: 1 });
    const effects = new CombatApEffectController({
      actionPoints,
      relicIds: ["relic_hungry_grip"],
      random: () => 0,
    });
    const melee = skill({ tags: ["sword", "basic"] });

    expect(effects.onSkillImpact(melee)).toBe(1);
    expect(actionPoints.snapshot.currentAp).toBe(2);
  });
});
