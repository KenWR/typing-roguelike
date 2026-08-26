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
