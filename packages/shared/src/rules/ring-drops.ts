import { RING_CONFIGS, RING_BY_ID } from "../content/rings.ts";
import type { RingConfig } from "../content/types.ts";
import type { RunState } from "../contracts/backend/run-state.ts";
import { equipLoadoutItem } from "./loadout-slots.ts";

export type GenerateRingRewardCandidatesInput = Readonly<{
  count: number;
  random?: () => number;
  excludedRingIds?: readonly string[];
  rings?: readonly RingConfig[];
}>;

const validateCount = (count: number): number => {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("Ring reward count must be a non-negative safe integer.");
  }
  return count;
};

const getRandomIndex = (length: number, random: () => number): number => {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Ring random value must be in [0, 1).");
  }
  return Math.floor(value * length);
};

export const generateRingRewardCandidates = ({
  count,
  random = Math.random,
  excludedRingIds = [],
  rings = RING_CONFIGS,
}: GenerateRingRewardCandidatesInput): readonly RingConfig[] => {
  validateCount(count);
  const excluded = new Set(excludedRingIds);
  const available = [...new Map(
    rings
      .filter(({ rarity, id }) => rarity !== "hidden" && !excluded.has(id))
      .map((ring) => [ring.id, ring] as const),
  ).values()];
  const result: RingConfig[] = [];
  while (result.length < count && available.length > 0) {
    result.push(available.splice(getRandomIndex(available.length, random), 1)[0]!);
  }
  return result;
};

export const ownsRing = (
  runState: Readonly<RunState>,
  ringId: string,
): boolean => runState.inventory.itemInstances.includes(ringId);

export const getRingPrice = (ring: RingConfig): number =>
  Math.max(1, Math.ceil(ring.sellValue * 2));

/**
 * 반지는 일반 장비와 같은 inventory.itemInstances에 보관한다. 기존 저장 스키마를
 * 불필요하게 변경하지 않으면서 이미 존재하는 ring1Id/ring2Id 슬롯으로 장착 상태를 저장한다.
 */
export const applyRingAcquisition = (
  runState: Readonly<RunState>,
  ringId: string,
): RunState => {
  const ring = RING_BY_ID.get(ringId);
  if (ring === undefined) throw new RangeError(`Unknown ring: ${ringId}`);

  const itemInstances = ownsRing(runState, ringId)
    ? [...runState.inventory.itemInstances]
    : [...runState.inventory.itemInstances, ringId];

  let loadout = { ...runState.loadout };
  if (loadout.ring1Id === null) {
    loadout = equipLoadoutItem({
      loadout,
      itemId: ring.id,
      itemType: "ring",
      targetSlot: "ring1Id",
    }).loadout;
  } else if (loadout.ring2Id === null) {
    loadout = equipLoadoutItem({
      loadout,
      itemId: ring.id,
      itemType: "ring",
      targetSlot: "ring2Id",
    }).loadout;
  }

  return {
    ...runState,
    inventory: { ...runState.inventory, itemInstances },
    loadout,
  };
};
