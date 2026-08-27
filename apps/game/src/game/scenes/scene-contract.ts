export const SCENE_KEYS = {
  boot: "BootScene",
  start: "StartScene",
  settings: "SettingsScene",
  map: "MapScene",
  combat: "CombatFoundationScene",
  reward: "RewardSelectionScene",
  equipment: "EquipmentScene",
  shop: "ShopScene",
  rest: "RestScene",
  runResult: "RunResultScene",
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

export const CORE_SCENE_KEYS = Object.freeze(Object.values(SCENE_KEYS)) as readonly SceneKey[];

export type SceneObjectPayload = Readonly<Record<string, unknown>>;
export type EmptyScenePayload = undefined;

export type SceneRecoveryPayload = Readonly<{
  recovery: Readonly<{
    reason: "invalid-scene-transition";
    attemptedScene: string;
  }>;
}>;

export type StartScenePayload = EmptyScenePayload | SceneRecoveryPayload;
export type SettingsScenePayload = EmptyScenePayload | SceneObjectPayload;
export type MapScenePayload = EmptyScenePayload | SceneObjectPayload;
export type CombatScenePayload = EmptyScenePayload | SceneObjectPayload;
export type RewardScenePayload = EmptyScenePayload | SceneObjectPayload;
export type EquipmentScenePayload = EmptyScenePayload | SceneObjectPayload;
export type ShopScenePayload = EmptyScenePayload | SceneObjectPayload;
export type RestScenePayload = EmptyScenePayload | SceneObjectPayload;
export type RunResultScenePayload = EmptyScenePayload | SceneObjectPayload;

export type ScenePayloadMap = {
  [SCENE_KEYS.boot]: EmptyScenePayload;
  [SCENE_KEYS.start]: StartScenePayload;
  [SCENE_KEYS.settings]: SettingsScenePayload;
  [SCENE_KEYS.map]: MapScenePayload;
  [SCENE_KEYS.combat]: CombatScenePayload;
  [SCENE_KEYS.reward]: RewardScenePayload;
  [SCENE_KEYS.equipment]: EquipmentScenePayload;
  [SCENE_KEYS.shop]: ShopScenePayload;
  [SCENE_KEYS.rest]: RestScenePayload;
  [SCENE_KEYS.runResult]: RunResultScenePayload;
};

export type ScenePayload<K extends SceneKey> = ScenePayloadMap[K];

export type ResolvedSceneTransition<K extends SceneKey = SceneKey> = Readonly<{
  key: K;
  payload: ScenePayload<K>;
  recovered: boolean;
}>;

const SCENE_KEY_SET = new Set<string>(CORE_SCENE_KEYS);

const isObjectPayload = (payload: unknown): payload is SceneObjectPayload =>
  payload === undefined ||
  (typeof payload === "object" && payload !== null && !Array.isArray(payload));

const isStartPayload = (payload: unknown): payload is StartScenePayload => {
  if (payload === undefined) {
    return true;
  }
  if (!isObjectPayload(payload)) {
    return false;
  }

  const recovery = payload.recovery;
  if (recovery === undefined) {
    return false;
  }
  if (typeof recovery !== "object" || recovery === null || Array.isArray(recovery)) {
    return false;
  }

  return (
    Reflect.get(recovery, "reason") === "invalid-scene-transition" &&
    typeof Reflect.get(recovery, "attemptedScene") === "string"
  );
};

export const isSceneKey = (value: unknown): value is SceneKey =>
  typeof value === "string" && SCENE_KEY_SET.has(value);

export const isScenePayload = <K extends SceneKey>(
  key: K,
  payload: unknown,
): payload is ScenePayload<K> => {
  if (key === SCENE_KEYS.boot) {
    return payload === undefined;
  }
  if (key === SCENE_KEYS.start) {
    return isStartPayload(payload);
  }
  return isObjectPayload(payload);
};

const recoveryTransition = (attemptedScene: unknown): ResolvedSceneTransition<
  typeof SCENE_KEYS.start
> => ({
  key: SCENE_KEYS.start,
  payload: {
    recovery: {
      reason: "invalid-scene-transition",
      attemptedScene:
        typeof attemptedScene === "string" ? attemptedScene : String(attemptedScene),
    },
  },
  recovered: true,
});

export function resolveSceneTransition<K extends SceneKey>(
  key: K,
  payload: ScenePayload<K>,
): ResolvedSceneTransition<K>;
export function resolveSceneTransition(
  key: unknown,
  payload: unknown,
): ResolvedSceneTransition;
export function resolveSceneTransition(
  key: unknown,
  payload: unknown,
): ResolvedSceneTransition {
  if (!isSceneKey(key) || !isScenePayload(key, payload)) {
    return recoveryTransition(key);
  }

  return {
    key,
    payload,
    recovered: false,
  } as ResolvedSceneTransition;
}
