export const RUNTIME_AUDIO_PATHS = Object.freeze({
  menuBgm: "/assets/audio/전체 배경음.mp3",
  towerBgm: "/assets/audio/탑 등반음.mp3",
  bossBgm: "/assets/audio/보스전.mp3",
  impactHit: "/assets/audio/맞는소리 타격.mp3",
});

export type RuntimeBgmCue = "menu" | "tower" | "boss";

const BGM_PATH_BY_CUE: Readonly<Record<RuntimeBgmCue, string>> = Object.freeze({
  menu: RUNTIME_AUDIO_PATHS.menuBgm,
  tower: RUNTIME_AUDIO_PATHS.towerBgm,
  boss: RUNTIME_AUDIO_PATHS.bossBgm,
});

let muted = false;
let currentBgmCue: RuntimeBgmCue | null = null;
let currentBgm: HTMLAudioElement | null = null;
let unlockListenerInstalled = false;

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

export const setRuntimeAudioMuted = (nextMuted: boolean): void => {
  muted = nextMuted;
  if (currentBgm !== null) {
    currentBgm.muted = muted;
  }
};

export const playRuntimeBgm = (cue: RuntimeBgmCue): void => {
  if (currentBgmCue === cue && currentBgm !== null) {
    currentBgm.muted = muted;
    if (currentBgm.paused) {
      void currentBgm.play().catch(() => installAudioUnlockListener());
    }
    return;
  }

  currentBgm?.pause();
  if (currentBgm !== null) currentBgm.currentTime = 0;

  const audio = createAudio(BGM_PATH_BY_CUE[cue]);
  currentBgmCue = cue;
  currentBgm = audio;
  if (audio === null) return;

  audio.loop = true;
  audio.volume = 0.35;
  audio.muted = muted;
  void audio.play().catch(() => installAudioUnlockListener());
};

export const playImpactHitSound = (): void => {
  if (muted) return;
  const audio = createAudio(RUNTIME_AUDIO_PATHS.impactHit);
  if (audio === null) return;
  audio.volume = 0.72;
  void audio.play().catch(() => undefined);
};
