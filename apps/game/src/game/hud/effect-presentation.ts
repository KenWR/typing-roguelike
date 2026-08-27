import { resolveEffectTextureKey } from "../assets/effect-visual-assets";

export const EFFECT_PLACEHOLDER_TEXTURE_KEY = "placeholder:missing-asset";

export type EffectPresentationInput = Readonly<{
  id: string;
  effectId: string;
  name?: string;
  description?: string;
  durationMs: number | null;
  remainingMs: number | null;
  stacks?: number;
}>;

export type EffectPresentation = Readonly<{
  id: string;
  effectId: string;
  name: string;
  description: string;
  durationMs: number | null;
  remainingMs: number | null;
  stacks: number;
  textureKey: string;
}>;

export type TimedStatusLike = Readonly<{
  statusId: string;
  durationMs: number;
  remainingMs: number;
  stacks: number;
}>;

export type ShieldLike = Readonly<{
  id: string;
  amount: number;
  maxAmount: number;
  startsAtMs: number;
  endsAtMs: number;
}>;

export type TimedApEffectLike = Readonly<{
  id: string;
  amountPerSecond: number;
  durationMs: number;
  remainingMs: number;
}>;

const EFFECT_COPY: Readonly<Record<string, Readonly<{ name: string; description: string }>>> = {
  guard: { name: "방어 태세", description: "받는 피해를 줄이는 방어 효과" },
  oath: { name: "맹세", description: "맹세 계열 강화 효과" },
  shield: { name: "실드", description: "피해를 대신 흡수하는 보호막" },
  "eclipse-mark": { name: "일식의 표식", description: "특수 표식 효과" },
  "time-stop": { name: "시간 정지", description: "행동을 일시 정지시키는 효과" },
  "enemy-delay": { name: "행동 지연", description: "적의 다음 행동을 지연시키는 효과" },
  "accuracy-down": { name: "명중률 감소", description: "명중 성능이 감소한 상태" },
  stun: { name: "기절", description: "행동할 수 없는 상태" },
  crack: { name: "파쇄", description: "방어가 약화된 상태" },
  weaken: { name: "약화", description: "공격 성능이 감소한 상태" },
  "ap-regen-down": { name: "AP 재생 감소", description: "AP 회복 속도가 감소한 상태" },
  bleed: { name: "출혈", description: "출혈 상태" },
  "burning-bleed": { name: "화상성 출혈", description: "화상과 출혈이 겹친 상태" },
  "ap-regen-up": { name: "AP 재생 증가", description: "AP 회복 속도가 증가한 상태" },
};

const normalizeEffectId = (effectId: string): string =>
  effectId.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");

const EFFECT_PRESENTATION_ALIASES: Readonly<Record<string, string>> = {
  bleeding: "bleed",
  bleed: "bleed",
  weakness: "weaken",
  weakened: "weaken",
  weaken: "weaken",
  stunned: "stun",
  stun: "stun",
  delayed: "enemy-delay",
  delay: "enemy-delay",
  "delayed-action": "enemy-delay",
  "enemy-delay": "enemy-delay",
  accuracy: "accuracy-down",
  "accuracy-down": "accuracy-down",
  fracture: "crack",
  cracked: "crack",
  crack: "crack",
  "ap-regeneration-up": "ap-regen-up",
  "ap-regen-up": "ap-regen-up",
  "ap-regeneration-down": "ap-regen-down",
  "ap-regen-down": "ap-regen-down",
};

export function resolvePresentationEffectId(effectId: string): string {
  const normalized = normalizeEffectId(effectId);
  return EFFECT_PRESENTATION_ALIASES[normalized] ?? normalized;
}

export function resolveEffectPresentation(input: EffectPresentationInput): EffectPresentation {
  const effectId = resolvePresentationEffectId(input.effectId);
  const copy = EFFECT_COPY[effectId];
  return {
    id: input.id,
    effectId,
    name: input.name ?? copy?.name ?? input.effectId,
    description: input.description ?? copy?.description ?? input.effectId,
    durationMs: input.durationMs,
    remainingMs: input.remainingMs,
    stacks: Math.max(1, Math.floor(input.stacks ?? 1)),
    textureKey: resolveEffectTextureKey(effectId) ?? EFFECT_PLACEHOLDER_TEXTURE_KEY,
  };
}

export function createActorEffectPresentations(
  input: Readonly<{
    statuses?: readonly TimedStatusLike[];
    shields?: readonly ShieldLike[];
    apEffects?: readonly TimedApEffectLike[];
    atMs?: number;
  }>,
): EffectPresentation[] {
  const atMs = input.atMs ?? 0;
  const statusGroups = new Map<string, TimedStatusLike[]>();
  for (const status of input.statuses ?? []) {
    if (status.remainingMs <= 0) continue;
    const key = resolvePresentationEffectId(status.statusId);
    const group = statusGroups.get(key) ?? [];
    group.push(status);
    statusGroups.set(key, group);
  }

  const statuses = Array.from(statusGroups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([effectId, group]) => {
      const durationMs = Math.max(...group.map((status) => status.durationMs));
      const remainingMs = Math.max(...group.map((status) => status.remainingMs));
      const stacks = group.reduce((sum, status) => sum + status.stacks, 0);
      return resolveEffectPresentation({
        id: `status:${effectId}`,
        effectId,
        durationMs,
        remainingMs,
        stacks,
      });
    });

  const shields = (input.shields ?? [])
    .filter((shield) => shield.amount > 0 && shield.endsAtMs > atMs)
    .sort((left, right) => left.endsAtMs - right.endsAtMs || left.id.localeCompare(right.id))
    .map((shield) =>
      resolveEffectPresentation({
        id: `shield:${shield.id}`,
        effectId: "shield",
        description: `실드 ${shield.amount} / ${shield.maxAmount}`,
        durationMs: Math.max(0, shield.endsAtMs - shield.startsAtMs),
        remainingMs: Math.max(0, shield.endsAtMs - atMs),
      }),
    );

  const apEffects = (input.apEffects ?? [])
    .filter((effect) => effect.remainingMs > 0)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((effect) =>
      resolveEffectPresentation({
        id: `ap:${effect.id}`,
        effectId: effect.amountPerSecond >= 0 ? "ap-regen-up" : "ap-regen-down",
        description: `AP 재생 ${effect.amountPerSecond >= 0 ? "+" : ""}${effect.amountPerSecond}/초`,
        durationMs: effect.durationMs,
        remainingMs: effect.remainingMs,
      }),
    );

  return [...statuses, ...shields, ...apEffects];
}

export function getEffectDarknessRatio(effect: Pick<EffectPresentation, "durationMs" | "remainingMs">): number {
  if (effect.durationMs === null || effect.remainingMs === null || effect.durationMs <= 0) return 0;
  const remainingRatio = Math.min(Math.max(effect.remainingMs / effect.durationMs, 0), 1);
  return 1 - remainingRatio;
}

export function formatEffectRemainingTime(remainingMs: number | null): string {
  if (remainingMs === null) return "지속시간: 발동 시 적용";
  if (remainingMs >= 1_000) return `남은 시간: ${(remainingMs / 1_000).toFixed(1)}초`;
  return `남은 시간: ${Math.ceil(Math.max(0, remainingMs))}ms`;
}
