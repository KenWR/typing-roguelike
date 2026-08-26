import type { SkillDefinition } from "@typing-roguelike/shared";
import { ActionPointResource } from "./action-point-resource";

const MELEE_TAGS = new Set(["sword", "greatsword", "mace", "club"]);

const parseImmediateApDelta = (skill: SkillDefinition): number => {
  if (skill.apDeltaOnHit !== undefined) return skill.apDeltaOnHit;
  const effect = skill.effect ?? skill.description;
  const leadingRecovery = effect.match(/^AP (\d+) 회복/);
  if (leadingRecovery !== null) return Number(leadingRecovery[1]);
  const trailingGain = effect.match(/\+ AP (\d+)(?:\D|$)/);
  if (trailingGain !== null) return Number(trailingGain[1]);
  const exactReturn = effect.match(/정확 입력 시 AP (\d+) 반환/);
  if (exactReturn !== null) return Number(exactReturn[1]);
  return 0;
};

export type CombatApEffectControllerConfig = Readonly<{
  actionPoints: ActionPointResource;
  relicIds?: readonly string[];
  random?: () => number;
}>;

/** 입력/행동 시간 보정 대신 AP 비용·회복으로 통일한 전투 효과 컨트롤러입니다. */
export class CombatApEffectController {
  private readonly actionPoints: ActionPointResource;
  private readonly relicIds: ReadonlySet<string>;
  private readonly random: () => number;
  private meditationDiscountArmed = false;
  private metronomeTriggered = false;
  private deleteKeyTriggered = false;

  constructor(config: CombatApEffectControllerConfig) {
    this.actionPoints = config.actionPoints;
    this.relicIds = new Set(config.relicIds ?? []);
    this.random = config.random ?? Math.random;
  }

  resolveSkillCost(skill: SkillDefinition): number {
    let cost = skill.apCost;
    if (this.relicIds.has("relic_fire_scroll") && skill.category === "special") cost += 1;
    if (this.relicIds.has("relic_old_shield") && skill.category === "guard") cost += 1;
    if (this.relicIds.has("relic_heavy_greatsword") && skill.name === "휘두르기") cost += 1;
    if (this.relicIds.has("relic_heavy_armor")) cost += 1;
    if (this.meditationDiscountArmed && skill.category === "special") cost -= 1;

    const minimumDiscountedCost = skill.apCost > 0 ? 1 : 0;
    cost = Math.max(minimumDiscountedCost, cost);

    const isMagic = skill.tags?.some((tag) => tag === "wand" || tag === "staff" || tag === "magic") ?? false;
    if (this.relicIds.has("relic_book_of_wisdom") && isMagic && this.random() < 0.2) cost = 0;
    return cost;
  }

  resolveGuardDuration(durationMs: number): number {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError("Guard duration must be a finite non-negative number.");
    }

    let adjustedDurationMs = durationMs;
    if (this.relicIds.has("relic_time_wristband")) adjustedDurationMs += 200;
    if (this.relicIds.has("relic_old_shield")) adjustedDurationMs += 300;
    return adjustedDurationMs;
  }

  onSkillStarted(skill: SkillDefinition, comboCount: number): void {
    if (this.meditationDiscountArmed && skill.category === "special") this.meditationDiscountArmed = false;
    if (this.relicIds.has("relic_incense_of_meditation") && skill.name === "명상") this.meditationDiscountArmed = true;
    if (this.relicIds.has("relic_broken_metronome") && comboCount >= 3 && !this.metronomeTriggered) {
      this.metronomeTriggered = true;
      this.actionPoints.addTemporaryRegeneration(0.5, 3_000);
    }
  }

  onSkillImpact(skill: SkillDefinition): number {
    let delta = parseImmediateApDelta(skill);
    const tags = skill.tags ?? [];
    const isMelee = tags.some((tag) => MELEE_TAGS.has(tag));
    const isMagic = tags.some((tag) => tag === "wand" || tag === "staff" || tag === "magic");

    if (this.relicIds.has("relic_hungry_grip") && isMelee && this.random() < 0.2) delta += 1;
    if (skill.category === "basic") {
      if (this.relicIds.has("relic_stenographer_quill")) delta += 1;
      if (this.relicIds.has("relic_ticklish_gloves") && this.random() < 0.2) delta += 1;
      if (this.relicIds.has("relic_delayed_blade") && this.random() < 0.2) delta += 1;
    }
    if (isMagic && this.relicIds.has("relic_frost_scroll")) delta += 1;
    if (skill.category === "special" && this.relicIds.has("relic_silence_scroll")) delta += 1;
    if (skill.category === "special" && this.relicIds.has("relic_delete_key") && !this.deleteKeyTriggered) {
      this.deleteKeyTriggered = true;
      delta += 1;
    }
    if (delta !== 0) this.actionPoints.adjust(delta);
    return delta;
  }
}
