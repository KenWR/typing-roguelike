import { EQUIPMENT_CONFIGS } from "@typing-roguelike/shared";

export const RUNTIME_AUDIO_PATHS = Object.freeze({
  menuBgm: "/assets/audio/전체 배경음.mp3",
  towerBgm: "/assets/audio/탑 등반음.mp3",
  bossBgm: "/assets/audio/보스전.mp3",
  normalHits: [
    "/assets/audio/맞는소리 타격.mp3",
    "/assets/audio/맞는소리2.mp3",
    "/assets/audio/맞는소리3.mp3",
  ] as const,
  strongHit: "/assets/audio/맞는소리 강하게.mp3",
  block: "/assets/audio/막는소리.mp3",
  magic: "/assets/audio/마법소리.mp3",
  blunt: "/assets/audio/둔기.mp3",
  slashes: ["/assets/audio/칼질 1.mp3", "/assets/audio/칼질 2.mp3"] as const,
  bow: "/assets/audio/활.mp3",
  relicPickup: "/assets/audio/유물 줍는 소리.mp3",
  coin: "/assets/audio/동전.mp3",
  walk: "/assets/audio/걷는소리.mp3",
});

export type RuntimeBgmCue = "menu" | "tower" | "boss";

export type RuntimeAudioSettings = Readonly<{
  muted: boolean;
  volume: number;
}>;

const BGM_PATH_BY_CUE: Readonly<Record<RuntimeBgmCue, string>> = Object.freeze({
  menu: RUNTIME_AUDIO_PATHS.menuBgm,
  tower: RUNTIME_AUDIO_PATHS.towerBgm,
  boss: RUNTIME_AUDIO_PATHS.bossBgm,
});

let muted = false;
let runtimeVolume = 1;
let currentBgmCue: RuntimeBgmCue | null = null;
let currentBgm: HTMLAudioElement | null = null;
let unlockListenerInstalled = false;

const normalizeRuntimeVolume = (volume: number): number =>
  Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;

const scaledVolume = (volume: number): number => volume * runtimeVolume;

const createAudio = (path: string): HTMLAudioElement | null => {
  if (typeof Audio === "undefined") return null;
  const audio = new Audio(path);
  audio.preload = "auto";
  return audio;
};

const retryCurrentBgm = (): void => {
  unlockListenerInstalled = false;
  if (currentBgm === null || currentBgmCue === null) return;
  void currentBgm.play().catch(() => installAudioUnlockListener());
};

const installAudioUnlockListener = (): void => {
  if (unlockListenerInstalled || typeof window === "undefined") return;
  unlockListenerInstalled = true;
  window.addEventListener("pointerdown", retryCurrentBgm, { once: true });
  window.addEventListener("keydown", retryCurrentBgm, { once: true });
};

const playSfx = (path: string, volume = 0.72): void => {
  if (muted) return;
  const audio = createAudio(path);
  if (audio === null) return;
  audio.volume = scaledVolume(volume);
  void audio.play().catch(() => undefined);
};

const pickRandom = <T>(values: readonly T[], random: () => number = Math.random): T =>
  values[Math.min(Math.floor(random() * values.length), values.length - 1)]!;

export const setRuntimeAudioMuted = (nextMuted: boolean): void => {
  muted = nextMuted;
  if (currentBgm !== null) currentBgm.muted = muted;
};

export const setRuntimeAudioVolume = (nextVolume: number): void => {
  runtimeVolume = normalizeRuntimeVolume(nextVolume);
  if (currentBgm !== null) currentBgm.volume = scaledVolume(0.35);
};

export const setRuntimeAudioSettings = (settings: RuntimeAudioSettings): void => {
  setRuntimeAudioMuted(settings.muted);
  setRuntimeAudioVolume(settings.volume);
};

export const playRuntimeBgm = (cue: RuntimeBgmCue): void => {
  if (currentBgmCue === cue && currentBgm !== null) {
    currentBgm.muted = muted;
    if (currentBgm.paused) void currentBgm.play().catch(() => installAudioUnlockListener());
    return;
  }

  currentBgm?.pause();
  if (currentBgm !== null) currentBgm.currentTime = 0;
  const audio = createAudio(BGM_PATH_BY_CUE[cue]);
  currentBgmCue = cue;
  currentBgm = audio;
  if (audio === null) return;
  audio.loop = true;
  audio.volume = scaledVolume(0.35);
  audio.muted = muted;
  void audio.play().catch(() => installAudioUnlockListener());
};

export const playPlayerHitSound = (
  options: Readonly<{ defended: boolean; special: boolean }>,
): void => {
  if (options.defended) {
    playSfx(RUNTIME_AUDIO_PATHS.block);
    return;
  }
  if (options.special) {
    playSfx(RUNTIME_AUDIO_PATHS.strongHit);
    return;
  }
  playSfx(pickRandom(RUNTIME_AUDIO_PATHS.normalHits));
};

export const playWeaponImpactSound = (equipmentIds: readonly string[]): void => {
  const weapon = equipmentIds
    .map((id) => EQUIPMENT_CONFIGS.find((candidate) => candidate.id === id))
    .find((equipment) => equipment?.slot === "weapon");
  switch (weapon?.kind) {
    case "wand":
    case "staff":
    case "tome":
    case "orb":
      playSfx(RUNTIME_AUDIO_PATHS.magic);
      return;
    case "mace":
    case "club":
      playSfx(RUNTIME_AUDIO_PATHS.blunt);
      return;
    case "bow":
    case "crossbow":
    case "quiver":
      playSfx(RUNTIME_AUDIO_PATHS.bow);
      return;
    case "sword":
    case "greatsword":
    default:
      playSfx(pickRandom(RUNTIME_AUDIO_PATHS.slashes));
  }
};

export const playRewardPickupSound = (): void => playSfx(RUNTIME_AUDIO_PATHS.relicPickup, 0.8);
export const playCoinSound = (): void => playSfx(RUNTIME_AUDIO_PATHS.coin, 0.8);
export const playWalkSound = (): void => playSfx(RUNTIME_AUDIO_PATHS.walk, 0.65);
