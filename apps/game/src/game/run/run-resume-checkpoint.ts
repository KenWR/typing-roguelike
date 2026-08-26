import type { GeneratedMapNode, LegacyShopOffer, ShopOffer } from "@typing-roguelike/shared";
import { SCENE_KEYS } from "../scenes/scene-contract";

export const RUN_RESUME_CHECKPOINT_STORAGE_KEY =
  "typing-roguelike.active-run-resume-checkpoint";
export const RUN_RESUME_CHECKPOINT_VERSION = 1;

export type RunResumeSceneKey =
  | typeof SCENE_KEYS.combat
  | typeof SCENE_KEYS.shop
  | typeof SCENE_KEYS.rest
  | typeof SCENE_KEYS.reward;

export type RunResumeCheckpoint = Readonly<{
  version: typeof RUN_RESUME_CHECKPOINT_VERSION;
  sceneKey: RunResumeSceneKey;
  node: GeneratedMapNode;
  nextNodeIds: readonly string[];
  rewardEquipmentIds?: readonly string[];
  shopOffers?: readonly ShopOffer[];
  purchasedOfferIds?: readonly string[];
  shopRerollCount?: number;
}>;

export type RunResumeCheckpointStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isSceneKey = (value: unknown): value is RunResumeSceneKey =>
  value === SCENE_KEYS.combat ||
  value === SCENE_KEYS.shop ||
  value === SCENE_KEYS.rest ||
  value === SCENE_KEYS.reward;

const isGeneratedMapNode = (value: unknown): value is GeneratedMapNode => {
  if (!isRecord(value)) return false;
  if (
    typeof value.key !== "string" ||
    typeof value.parentKey !== "string" ||
    typeof value.round !== "number" ||
    typeof value.choice !== "number" ||
    typeof value.type !== "string" ||
    typeof value.icon !== "string" ||
    typeof value.iconType !== "string" ||
    !isStringArray(value.nextNodeKeys)
  ) {
    return false;
  }
  return value.monsterId === undefined || typeof value.monsterId === "string";
};

/** kind 가 없던 시절 저장된 진열도 복원할 수 있게 두 형식을 모두 허용한다. */
const isShopOffer = (value: unknown): value is ShopOffer | LegacyShopOffer =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.price === "number" &&
  ((value.kind === "equipment" || value.kind === "relic") && typeof value.itemId === "string"
    ? true
    : value.kind === undefined && typeof value.equipmentId === "string");

const isShopOfferArray = (value: unknown): value is (ShopOffer | LegacyShopOffer)[] =>
  Array.isArray(value) && value.every(isShopOffer);

const isRunResumeCheckpoint = (value: unknown): value is RunResumeCheckpoint => {
  if (!isRecord(value)) return false;
  if (value.version !== RUN_RESUME_CHECKPOINT_VERSION) return false;
  if (!isSceneKey(value.sceneKey) || !isGeneratedMapNode(value.node)) return false;
  if (!isStringArray(value.nextNodeIds)) return false;
  if (
    value.rewardEquipmentIds !== undefined &&
    !isStringArray(value.rewardEquipmentIds)
  ) {
    return false;
  }
  if (value.shopOffers !== undefined && !isShopOfferArray(value.shopOffers)) {
    return false;
  }
  if (
    value.purchasedOfferIds !== undefined &&
    !isStringArray(value.purchasedOfferIds)
  ) {
    return false;
  }
  const shopRerollCount = value.shopRerollCount;
  if (
    shopRerollCount !== undefined &&
    (typeof shopRerollCount !== "number" ||
      !Number.isSafeInteger(shopRerollCount) ||
      shopRerollCount < 0)
  ) {
    return false;
  }
  return true;
};

export const saveRunResumeCheckpoint = (
  checkpoint: RunResumeCheckpoint,
  storage?: RunResumeCheckpointStorage,
): void => {
  if (!storage) return;
  try {
    storage.setItem(
      RUN_RESUME_CHECKPOINT_STORAGE_KEY,
      JSON.stringify(checkpoint),
    );
  } catch {
    // The active run remains usable when browser storage is unavailable.
  }
};

export const loadRunResumeCheckpoint = (
  storage?: Pick<RunResumeCheckpointStorage, "getItem" | "removeItem">,
): RunResumeCheckpoint | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RUN_RESUME_CHECKPOINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRunResumeCheckpoint(parsed)) {
      clearRunResumeCheckpoint(storage);
      return null;
    }
    return parsed;
  } catch {
    clearRunResumeCheckpoint(storage);
    return null;
  }
};

export const clearRunResumeCheckpoint = (
  storage?: Pick<RunResumeCheckpointStorage, "removeItem">,
): void => {
  if (!storage) return;
  try {
    storage.removeItem(RUN_RESUME_CHECKPOINT_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
};
