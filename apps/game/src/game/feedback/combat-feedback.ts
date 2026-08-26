export type CombatFeedbackCue =
  | "command-success"
  | "command-failure"
  | "player-hit"
  | "guard"
  | "victory"
  | "defeat";

export const COMBAT_SOUND_KEYS: Readonly<Record<CombatFeedbackCue, string>> = Object.freeze({
  "command-success": "sfx:command-success",
  "command-failure": "sfx:command-failure",
  "player-hit": "sfx:player-hit",
  guard: "sfx:guard",
  victory: "sfx:victory",
  defeat: "sfx:defeat",
});

export type CombatFeedbackRuntime = Readonly<{
  playSound: (key: string) => unknown;
  shakeCamera: () => unknown;
  isScreenShakeEnabled: () => boolean;
}>;

export type ProceduralAudioSettings = Readonly<{
  muted: boolean;
  volume: number;
}>;

const TONE_BY_KEY: Readonly<Record<string, Readonly<{ frequency: number; durationMs: number }>>> = Object.freeze({
  "sfx:command-success": { frequency: 660, durationMs: 55 },
  "sfx:command-failure": { frequency: 170, durationMs: 90 },
  "sfx:player-hit": { frequency: 110, durationMs: 120 },
  "sfx:guard": { frequency: 420, durationMs: 85 },
  "sfx:victory": { frequency: 880, durationMs: 180 },
  "sfx:defeat": { frequency: 82, durationMs: 220 },
});

export const playProceduralCombatSound = (
  key: string,
  settings: ProceduralAudioSettings,
): void => {
  if (settings.muted || settings.volume <= 0 || typeof window === "undefined") return;

  const AudioContextCtor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const tone = TONE_BY_KEY[key];
  if (AudioContextCtor === undefined || tone === undefined) return;

  try {
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const durationSeconds = tone.durationMs / 1000;

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(tone.frequency, now);
    gain.gain.setValueAtTime(Math.min(1, Math.max(0, settings.volume)) * 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds);
    oscillator.addEventListener("ended", () => {
      void context.close().catch(() => undefined);
    }, { once: true });
  } catch {
    // Browser audio may be unavailable, blocked, or fail to initialize.
  }
};

export class CombatFeedbackController {
  constructor(private readonly runtime: CombatFeedbackRuntime) {}

  trigger(cue: CombatFeedbackCue): void {
    try {
      this.runtime.playSound(COMBAT_SOUND_KEYS[cue]);
    } catch {
      // Missing/failed audio must never interrupt combat progression.
    }

    if (cue !== "player-hit" || !this.runtime.isScreenShakeEnabled()) {
      return;
    }

    try {
      this.runtime.shakeCamera();
    } catch {
      // Visual feedback failure must not interrupt combat progression.
    }
  }
}
