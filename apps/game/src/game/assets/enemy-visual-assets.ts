export const COMBAT_BACKGROUND_ASSET = {
  key: "background:combat",
  path: "/assets/background/전투 배경.png",
} as const;

const ENEMY_NAMES_BY_ID = {
  "ink-slime": "먹물 슬라임",
  "hook-tentacle": "갈고리 촉수",
  "iron-beetle": "철갑 갑충",
  "bell-wraith": "종소리 망령",
  "mimic-doll": "모사 인형",
  "reverse-bat": "역철자 박쥐",
  "space-eater": "공백 포식자",
  "needle-gunner": "바늘_사수",
  "red-scribe": "붉은 필경사",
  "repair-golem": "수복_골렘",
  "explosive-spore": "폭발 포자",
  "chain-executor": "사슬_집행자",
  "mirror-doll": "거울 인형",
  "clock-tick": "초침 진드기",
  "ap-devourer": "행동력 포식자",
  "red-corrector": "붉은_교정관",
  "inverted-knight": "뒤집힌 기사",
  "chorus-conductor": "갈고리 촉수",
  "palimpsest": "붉은 편집장 팔림프세스트",
  "thousand-beat-chorus": "붉은 편집장 팔림프세스트",
  "beat-tentacle": "갈고리 촉수",
} as const;

export type EnemyVisualState =
  | "ready"
  | "special"
  | "defend"
  | "hit"
  | "disabled";

const FILE_SUFFIX_BY_STATE: Readonly<Record<EnemyVisualState, string>> = {
  ready: "행동준비",
  special: "특수행동준비",
  defend: "방어",
  hit: "피격",
  disabled: "행동불능",
};

export const enemyTextureKey = (
  enemyId: string,
  state: EnemyVisualState = "ready",
): string => `enemy:${enemyId}:${state}`;

export const ENEMY_IMAGE_ASSETS = Object.entries(ENEMY_NAMES_BY_ID).flatMap(
  ([enemyId, fileName]) =>
    (Object.entries(FILE_SUFFIX_BY_STATE) as [EnemyVisualState, string][]).map(
      ([state, suffix]) => ({
        key: enemyTextureKey(enemyId, state),
        path: `/assets/monster/${fileName}_${suffix}.png`,
      }),
    ),
);

export const resolveEnemyTextureKey = (
  enemyId: string | undefined,
  state: EnemyVisualState = "ready",
): string | undefined =>
  enemyId !== undefined && enemyId in ENEMY_NAMES_BY_ID
    ? enemyTextureKey(enemyId, state)
    : undefined;

export const resolveEnemyVisualState = (input: Readonly<{
  currentHp: number;
  hitRemainingMs: number;
  activeAttackId?: string;
}>): EnemyVisualState => {
  if (input.currentHp <= 0) return "disabled";
  if (input.hitRemainingMs > 0) return "hit";
  if (input.activeAttackId?.endsWith("-defense")) return "defend";
  if (
    input.activeAttackId !== undefined &&
    !input.activeAttackId.endsWith("-attack")
  ) {
    return "special";
  }
  return "ready";
};