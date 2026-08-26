import { describe, expect, test } from "bun:test";
import { defineSkill } from "@typing-roguelike/shared";
import { ActionPointResource } from "../src/game/combat/action-point-resource";
import { CombatApEffectController } from "../src/game/combat/combat-ap-effects";

const skill = (overrides: Partial<Parameters<typeof defineSkill>[0]> = {}) => defineSkill({
  id: "skill.test", name: "테스트", command: "테스트", kind: "attack", category: "basic",
  apCost: 2, windupMs: 0, recoveryMs: 0, description: "테스트", ...overrides,
});

describe("CombatApEffectController", () => {
  test("applies immediate equipment AP recovery descriptions", () => {
    const actionPoints = new ActionPointResource({ initialAp: 1 });
    const effects = new CombatApEffectController({ actionPoints });
    const recovered = skill({ id: "orb-meditate", name: "명상", command: "명상", kind: "utility", effect: "AP 2 회복, 선딜 0.75초" });
    expect(effects.onSkillImpact(recovered)).toBe(2);
    expect(actionPoints.snapshot.currentAp).toBe(3);
  });

  test("does not turn conditional AP text into an unconditional gain", () => {
    const actionPoints = new ActionPointResource({ initialAp: 1 });
    const effects = new CombatApEffectController({ actionPoints });
    expect(effects.onSkillImpact(skill({ effect: "보호막 제거 성공 시 AP 1 회복" }))).toBe(0);
    expect(actionPoints.snapshot.currentAp).toBe(1);
  });

  test("applies relic AP cost increases", () => {
    const actionPoints = new ActionPointResource();
    const effects = new CombatApEffectController({ actionPoints, relicIds: ["relic_fire_scroll", "relic_old_shield", "relic_heavy_greatsword"] });
    expect(effects.resolveSkillCost(skill({ category: "special" }))).toBe(3);
    expect(effects.resolveSkillCost(skill({ category: "guard", kind: "defense" }))).toBe(3);
    expect(effects.resolveSkillCost(skill({ name: "휘두르기", command: "휘두르기" }))).toBe(3);
  });

  test("applies shield duration relics without changing their documented AP cost", () => {
    const actionPoints = new ActionPointResource();
    const heavyArmor = new CombatApEffectController({ actionPoints, relicIds: ["relic_heavy_armor"] });
    expect(heavyArmor.resolveSkillCost(skill())).toBe(3);
    const wristband = new CombatApEffectController({ actionPoints, relicIds: ["relic_time_wristband"] });
    expect(wristband.resolveSkillCost(skill({ category: "guard", kind: "defense" }))).toBe(2);
    expect(wristband.resolveShieldDuration(800)).toBe(1_000);

    const oldShield = new CombatApEffectController({ actionPoints, relicIds: ["relic_old_shield"] });
    expect(oldShield.resolveShieldDuration(800)).toBe(1_100);
    expect(() => oldShield.resolveShieldDuration(Number.NaN)).toThrow(RangeError);

    const rampart = new CombatApEffectController({ actionPoints, relicIds: ["relic_rampart_shield"] });
    expect(rampart.resolveShieldDuration(800)).toBe(1_800);
  });

  test("shortens shield duration for relics that trade defence for value", () => {
    const actionPoints = new ActionPointResource();
    const pouch = new CombatApEffectController({ actionPoints, relicIds: ["relic_greedy_pouch"] });
    expect(pouch.resolveShieldDuration(800)).toBe(500);
    expect(pouch.resolveShieldDuration(200)).toBe(0);

    const both = new CombatApEffectController({
      actionPoints,
      relicIds: ["relic_greedy_pouch", "relic_time_wristband"],
    });
    expect(both.resolveShieldDuration(800)).toBe(700);
  });

  test("raises and lowers shield amount with flat and ratio relics", () => {
    const actionPoints = new ActionPointResource();
    expect(
      new CombatApEffectController({ actionPoints }).resolveShieldAmount(24),
    ).toBe(24);
    expect(
      new CombatApEffectController({ actionPoints, relicIds: ["relic_steel_fragment"] })
        .resolveShieldAmount(24),
    ).toBe(32);
    expect(
      new CombatApEffectController({ actionPoints, relicIds: ["relic_heavy_armor"] })
        .resolveShieldAmount(24),
    ).toBe(31);
    expect(
      new CombatApEffectController({ actionPoints, relicIds: ["relic_berserker_gloves"] })
        .resolveShieldAmount(24),
    ).toBe(19);
    expect(
      new CombatApEffectController({
        actionPoints,
        relicIds: ["relic_steel_fragment", "relic_berserker_gloves"],
      }).resolveShieldAmount(24),
    ).toBe(25);
    expect(() =>
      new CombatApEffectController({ actionPoints }).resolveShieldAmount(-1),
    ).toThrow(RangeError);
  });

  test("the typo correction charm boosts the next shield twice per combat", () => {
    const actionPoints = new ActionPointResource();
    const charm = new CombatApEffectController({
      actionPoints,
      relicIds: ["relic_typo_correction_charm"],
    });

    expect(charm.resolveShieldAmount(20)).toBe(20);
    charm.onCommandFailed();
    expect(charm.resolveShieldAmount(20)).toBe(26);
    charm.onShieldGranted();
    expect(charm.resolveShieldAmount(20)).toBe(20);

    charm.onCommandFailed();
    charm.onCommandFailed();
    charm.onShieldGranted();
    expect(charm.resolveShieldAmount(20)).toBe(20);
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
    const effects = new CombatApEffectController({ actionPoints, relicIds: ["relic_hungry_grip"], random: () => 0 });
    expect(effects.onSkillImpact(skill({ tags: ["sword", "basic"] }))).toBe(1);
    expect(actionPoints.snapshot.currentAp).toBe(2);
  });

  test("converts enemy-delay and input-time relics into AP recovery", () => {
    const actionPoints = new ActionPointResource({ initialAp: 0 });
    const effects = new CombatApEffectController({
      actionPoints,
      relicIds: ["relic_stenographer_quill", "relic_ticklish_gloves", "relic_delayed_blade"],
      random: () => 0,
    });
    expect(effects.onSkillImpact(skill())).toBe(3);
    expect(actionPoints.snapshot.currentAp).toBe(3);
  });

  test("magic/special delay relics restore AP and delete key triggers once", () => {
    const actionPoints = new ActionPointResource({ initialAp: 0 });
    const effects = new CombatApEffectController({ actionPoints, relicIds: ["relic_frost_scroll", "relic_silence_scroll", "relic_delete_key"] });
    const specialMagic = skill({ category: "special", tags: ["magic", "special"] });
    expect(effects.onSkillImpact(specialMagic)).toBe(3);
    expect(effects.onSkillImpact(specialMagic)).toBe(2);
    expect(actionPoints.snapshot.currentAp).toBe(5);
  });
});
