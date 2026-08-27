import type { SkillDefinition } from "@typing-roguelike/shared";
import type { ActionPointResource } from "./action-point-resource";

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
  private typoCorrectionCharges = 0;
  private typoCorrectionTriggerCount = 0;
  private blankSpaceUsed = false;
  private nextSkillDamageMultiplier = 1;
  private scabbardTriggered = false;
  private incomingProtectionUsed = false;
  private shieldAbsorbTriggers = 0;

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

  /**
   * 실드 지속시간 유물을 적용합니다. 증가 유물과 감소 유물이 함께 있으면
   * 합산한 뒤 0 아래로는 내려가지 않습니다.
   */
  resolveShieldDuration(durationMs: number): number {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError("Shield duration must be a finite non-negative number.");
    }

    let adjustedDurationMs = durationMs;
    if (this.relicIds.has("relic_time_wristband")) adjustedDurationMs += 200;
    if (this.relicIds.has("relic_old_shield")) adjustedDurationMs += 300;
    if (this.relicIds.has("relic_rampart_shield")) adjustedDurationMs += 1_000;
    if (this.relicIds.has("relic_greedy_pouch")) adjustedDurationMs -= 300;
    return Math.max(0, adjustedDurationMs);
  }

  /**
   * 실드량 유물을 적용합니다. 고정 증가를 먼저 더하고 비율 보정을 곱한 뒤
   * 정수로 내림합니다.
   */
  resolveShieldAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError("Shield amount must be a finite non-negative number.");
    }

    let flatBonus = 0;
    if (this.relicIds.has("relic_steel_fragment")) flatBonus += 8;
    if (this.typoCorrectionCharges > 0) flatBonus += 6;

    let multiplier = 1;
    if (this.relicIds.has("relic_heavy_armor")) multiplier += 0.3;
    if (this.relicIds.has("relic_berserker_gloves")) multiplier -= 0.2;

    return Math.max(0, Math.floor((amount + flatBonus) * Math.max(0, multiplier)));
  }

  /**
   * 커맨드 입력 실패를 기록합니다. 오타 교정 부적은 실패할 때마다 다음 실드량을
   * 늘려 주고, 전투당 두 번까지만 발동합니다.
   */
  onCommandFailed(): boolean {
    if (this.relicIds.has("relic_blank_space") && !this.blankSpaceUsed) {
      this.blankSpaceUsed = true;
      return true;
    }
    if (!this.relicIds.has("relic_typo_correction_charm")) return false;
    if (this.typoCorrectionTriggerCount >= 2) return false;
    this.typoCorrectionTriggerCount += 1;
    this.typoCorrectionCharges += 1;
    return false;
  }

  /** 실드를 실제로 부여한 뒤 1회성 실드량 보정을 소모합니다. */
  onShieldGranted(): void {
    if (this.typoCorrectionCharges > 0) this.typoCorrectionCharges -= 1;
  }

  onSkillStarted(skill: SkillDefinition, comboCount: number): void {
    if (this.meditationDiscountArmed && skill.category === "special") this.meditationDiscountArmed = false;
    if (this.relicIds.has("relic_incense_of_meditation") && skill.name === "명상") this.meditationDiscountArmed = true;
    if (this.relicIds.has("relic_broken_metronome") && comboCount >= 3 && !this.metronomeTriggered) {
      this.metronomeTriggered = true;
      this.actionPoints.addTemporaryRegeneration(0.5, 3_000);
    }
    if (this.relicIds.has("relic_editor_seal")) this.nextSkillDamageMultiplier *= 1.18;
    if (this.relicIds.has("relic_combo_type") && comboCount >= 5) this.nextSkillDamageMultiplier *= 1.4;
    if (this.relicIds.has("relic_scabbard") && skill.category === "basic" && !this.scabbardTriggered) {
      this.scabbardTriggered = true;
      this.nextSkillDamageMultiplier *= 1.35;
    }
  }

  /** Resolves combat-only damage bonuses and consumes one-shot triggers. */
  resolveSkillDamageMultiplier(skill: SkillDefinition): number {
    let multiplier = this.nextSkillDamageMultiplier;
    this.nextSkillDamageMultiplier = 1;
    if (this.relicIds.has("relic_red_ink")) multiplier *= 1.1;
    if (this.relicIds.has("relic_whetstone") && skill.category === "basic") multiplier *= 1.2;
    if (this.relicIds.has("relic_gamblers_dice")) multiplier *= skill.category === "basic" ? 1.15 : 0.85;
    return multiplier;
  }

  /** Returns a reflected amount after an enemy hit was absorbed by a player shield. */
  onShieldAbsorbed(absorbedDamage: number, fullyAbsorbed: boolean): number {
    if (absorbedDamage <= 0) return 0;
    this.shieldAbsorbTriggers += 1;
    if (this.relicIds.has("relic_veteran_shield") && this.shieldAbsorbTriggers <= 2) {
      this.actionPoints.adjust(1);
    }
    if (this.relicIds.has("relic_counter_inscription") && absorbedDamage >= 0) {
      this.nextSkillDamageMultiplier *= 1.3;
    }
    if (this.relicIds.has("relic_perfect_period") && fullyAbsorbed) {
      this.actionPoints.adjust(1);
      this.nextSkillDamageMultiplier *= 1.3;
    }
    if (this.relicIds.has("relic_mirror_shield")) return Math.round(absorbedDamage * 0.3);
    if (this.relicIds.has("relic_wavering_thorn_shield")) return Math.round(absorbedDamage * 0.5);
    return 0;
  }

  resolveIncomingDamage(currentHp: number, maxHp: number, damage: number): number {
    if (this.incomingProtectionUsed || damage <= 0) return damage;
    const ratio = maxHp <= 0 ? 1 : currentHp / maxHp;
    let multiplier = 1;
    if (this.relicIds.has("relic_prophets_eye")) multiplier *= 0.75;
    if (this.relicIds.has("relic_reversing_clock") && ratio <= 0.3) multiplier *= 0.5;
    if (this.relicIds.has("relic_mask_of_forgetting")) multiplier *= 0.8;
    if (multiplier === 1) return damage;
    this.incomingProtectionUsed = true;
    return Math.max(0, Math.round(damage * multiplier));
  }

  resolveIncomingDamageMultiplier(currentHp: number, maxHp: number): number {
    if (this.incomingProtectionUsed) return 1;
    const ratio = maxHp <= 0 ? 1 : currentHp / maxHp;
    if (
      this.relicIds.has("relic_prophets_eye") ||
      (this.relicIds.has("relic_reversing_clock") && ratio <= 0.3) ||
      this.relicIds.has("relic_mask_of_forgetting")
    ) {
      this.incomingProtectionUsed = true;
      let multiplier = 1;
      if (this.relicIds.has("relic_prophets_eye")) multiplier *= 0.75;
      if (this.relicIds.has("relic_reversing_clock") && ratio <= 0.3) multiplier *= 0.5;
      if (this.relicIds.has("relic_mask_of_forgetting")) multiplier *= 0.8;
      return multiplier;
    }
    return 1;
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
