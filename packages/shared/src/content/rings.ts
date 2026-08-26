import type { RingConfig } from "./types.ts";

/**
 * 반지는 독립 스킬이 아니라 기존 스킬의 커맨드/수치/적중 효과를 변형한다.
 * prefix/suffix 의미는 장착 슬롯이 아니라 각 RingConfig.position으로 결정된다.
 */
export const RING_CONFIGS = [
  {
    id: "ring_swift_prefix",
    name: "신속의 반지",
    position: "prefix",
    commandAffix: "신속한",
    rarity: "uncommon",
    sellValue: 18,
    description: "커맨드 앞에 '신속한'을 붙일 수 있다. 적용 기술의 선딜이 25% 감소한다.",
    modifiers: [{ windupMultiplier: 0.75 }],
  },
  {
    id: "ring_economy_prefix",
    name: "절약의 반지",
    position: "prefix",
    commandAffix: "간결한",
    rarity: "rare",
    sellValue: 24,
    description: "커맨드 앞에 '간결한'을 붙일 수 있다. 적용 기술의 AP 비용이 1 감소한다.",
    modifiers: [{ apCostDelta: -1 }],
  },
  {
    id: "ring_fury_prefix",
    name: "격노의 반지",
    position: "prefix",
    commandAffix: "맹렬한",
    rarity: "rare",
    sellValue: 26,
    description: "커맨드 앞에 '맹렬한'을 붙일 수 있다. 적용 기술의 피해가 30% 증가한다.",
    modifiers: [{ damageMultiplier: 1.3 }],
  },
  {
    id: "ring_chain_suffix",
    name: "연쇄의 반지",
    position: "suffix",
    commandAffix: "연속으로",
    rarity: "uncommon",
    sellValue: 20,
    description: "커맨드 뒤에 '연속으로'를 붙일 수 있다. 적용 기술의 피해가 15% 증가한다.",
    modifiers: [{ damageMultiplier: 1.15 }],
  },
  {
    id: "ring_bleed_suffix",
    name: "핏자국 반지",
    position: "suffix",
    commandAffix: "피를 남기며",
    rarity: "rare",
    sellValue: 28,
    description: "커맨드 뒤에 '피를 남기며'를 붙일 수 있다. 공격 적중 시 출혈 1중첩을 추가한다.",
    modifiers: [
      {
        skillCategories: ["basic", "special"],
        onHitStatus: { statusId: "bleed", durationMs: 4_000, stacks: 1 },
      },
    ],
  },
  {
    id: "ring_heavy_suffix",
    name: "중량의 반지",
    position: "suffix",
    commandAffix: "무겁게",
    rarity: "epic",
    sellValue: 34,
    description: "커맨드 뒤에 '무겁게'를 붙일 수 있다. 피해가 45% 증가하지만 AP 비용이 1 증가한다.",
    modifiers: [{ damageMultiplier: 1.45, apCostDelta: 1 }],
  },
] as const satisfies readonly RingConfig[];

export const RING_BY_ID: ReadonlyMap<string, RingConfig> = new Map(
  RING_CONFIGS.map((ring) => [ring.id, ring]),
);

export const getRingConfig = (ringId: string): RingConfig | undefined =>
  RING_BY_ID.get(ringId);
