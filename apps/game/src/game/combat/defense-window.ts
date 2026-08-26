export type DefenseWindow = Readonly<{
  id: string;
  defenderId: string;
  startsAtMs: number;
  endsAtMs: number;
  damageMultiplier: number;
}>;

export type DefenseImpactResult = Readonly<{
  defended: boolean;
  impactAtMs: number;
  defenderId: string;
  window: DefenseWindow | null;
}>;

const requireIdentifier = (name: string, value: string): string => {
  if (value.trim().length === 0) throw new RangeError(`${name} must not be empty.`);
  return value;
};

const requireTime = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
  return value;
};

const requireDamageMultiplier = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(
      "Defense window damage multiplier must be a finite number between 0 and 1.",
    );
  }
  return value;
};

export class DefenseWindowTracker {
  private readonly windows = new Map<string, DefenseWindow>();

  openWindow(
    id: string,
    defenderId: string,
    startsAtMs: number,
    durationMs: number,
    damageMultiplier = 1,
  ): DefenseWindow {
    const windowId = requireIdentifier("Defense window id", id);
    if (this.windows.has(windowId)) throw new Error(`Defense window id already exists: ${windowId}`);
    const start = requireTime("Defense window start", startsAtMs);
    const duration = requireTime("Defense window duration", durationMs);
    const window = {
      id: windowId,
      defenderId: requireIdentifier("Defender id", defenderId),
      startsAtMs: start,
      endsAtMs: start + duration,
      damageMultiplier: requireDamageMultiplier(damageMultiplier),
    } as const;
    this.windows.set(window.id, window);
    return window;
  }

  closeWindow(id: string): boolean {
    return this.windows.delete(id);
  }

  isDefendedAt(defenderId: string, impactAtMs: number): boolean {
    return this.findMatchingWindow(defenderId, impactAtMs) !== null;
  }

  resolveImpact(defenderId: string, impactAtMs: number): DefenseImpactResult {
    const defender = requireIdentifier("Defender id", defenderId);
    const impact = requireTime("Impact time", impactAtMs);
    const window = this.findMatchingWindow(defender, impact);
    return { defended: window !== null, impactAtMs: impact, defenderId: defender, window };
  }

  pruneExpired(beforeMs: number): void {
    const cutoff = requireTime("Defense window prune time", beforeMs);
    for (const [id, window] of this.windows) {
      if (window.endsAtMs < cutoff) this.windows.delete(id);
    }
  }

  private findMatchingWindow(defenderId: string, impactAtMs: number): DefenseWindow | null {
    const defender = requireIdentifier("Defender id", defenderId);
    const impact = requireTime("Impact time", impactAtMs);
    let selected: DefenseWindow | null = null;
    for (const window of this.windows.values()) {
      if (
        window.defenderId !== defender ||
        impact < window.startsAtMs ||
        impact > window.endsAtMs
      ) {
        continue;
      }
      if (
        selected === null ||
        window.damageMultiplier < selected.damageMultiplier ||
        (window.damageMultiplier === selected.damageMultiplier &&
          window.startsAtMs >= selected.startsAtMs)
      ) {
        selected = window;
      }
    }
    return selected;
  }
}
