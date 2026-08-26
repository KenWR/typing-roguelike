export type CombatPauseReason = "visibility" | "blur" | "manual";

export type PausableCombatResource = Readonly<{
  pause: () => unknown;
  resume: () => unknown;
}>;

export type PauseDocument = Readonly<{
  hidden: boolean;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
}>;

export type PauseWindow = Readonly<{
  addEventListener: (type: "blur" | "focus" | "keydown", listener: (event?: { key?: string }) => void) => void;
  removeEventListener: (type: "blur" | "focus" | "keydown", listener: (event?: { key?: string }) => void) => void;
}>;

export class CombatPauseController {
  private readonly reasons = new Set<CombatPauseReason>();
  private cleanup?: () => void;

  constructor(
    private readonly resources: readonly PausableCombatResource[],
    private readonly onPausedChange: (paused: boolean) => void = () => undefined,
  ) {}

  get paused(): boolean {
    return this.reasons.size > 0;
  }

  pause(reason: CombatPauseReason): void {
    const wasPaused = this.paused;
    this.reasons.add(reason);
    if (!wasPaused) {
      for (const resource of this.resources) resource.pause();
      this.onPausedChange(true);
    }
  }

  resume(reason: CombatPauseReason): void {
    const wasPaused = this.paused;
    this.reasons.delete(reason);
    if (wasPaused && !this.paused) {
      for (const resource of this.resources) resource.resume();
      this.onPausedChange(false);
    }
  }

  toggleManualPause(): void {
    if (this.reasons.has("manual")) this.resume("manual");
    else this.pause("manual");
  }

  bind(documentSource?: PauseDocument, windowSource?: PauseWindow): void {
    this.dispose();
    if (!documentSource || !windowSource) return;

    const visibility = () => {
      if (documentSource.hidden) this.pause("visibility");
      else this.resume("visibility");
    };
    const blur = () => this.pause("blur");
    const focus = () => this.resume("blur");
    const keydown = (event?: { key?: string }) => {
      if (event?.key === "Escape") this.toggleManualPause();
    };

    documentSource.addEventListener("visibilitychange", visibility);
    windowSource.addEventListener("blur", blur);
    windowSource.addEventListener("focus", focus);
    windowSource.addEventListener("keydown", keydown);
    this.cleanup = () => {
      documentSource.removeEventListener("visibilitychange", visibility);
      windowSource.removeEventListener("blur", blur);
      windowSource.removeEventListener("focus", focus);
      windowSource.removeEventListener("keydown", keydown);
      this.cleanup = undefined;
    };
  }

  dispose(): void {
    this.cleanup?.();
  }
}
