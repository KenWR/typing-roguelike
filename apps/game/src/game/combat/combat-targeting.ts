export type CombatTargetCandidate = Readonly<{
  id: string;
  isAlive: boolean;
}>;

export type TargetingKeyboardEvent = Readonly<{
  key?: string;
  shiftKey?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}>;

export type TargetingKeyboardSource = Readonly<{
  addEventListener: (
    type: "keydown",
    listener: (event: TargetingKeyboardEvent) => void,
    options?: { capture?: boolean },
  ) => void;
  removeEventListener: (
    type: "keydown",
    listener: (event: TargetingKeyboardEvent) => void,
    options?: { capture?: boolean },
  ) => void;
}>;

/**
 * 현재 대상의 다음(또는 이전) 순서부터 한 바퀴를 돌면서 살아 있는 첫 대상을
 * 고릅니다. 마지막 대상에서 한 번 더 넘기면 처음 대상으로 돌아옵니다.
 */
export const resolveNextTargetId = (
  candidates: readonly CombatTargetCandidate[],
  currentId: string | undefined,
  direction: 1 | -1 = 1,
): string | undefined => {
  if (candidates.length === 0) return undefined;

  const currentIndex = candidates.findIndex(
    (candidate) => candidate.id === currentId,
  );
  const origin = currentIndex === -1 ? (direction === 1 ? -1 : 0) : currentIndex;

  for (let step = 1; step <= candidates.length; step += 1) {
    const index =
      (((origin + step * direction) % candidates.length) + candidates.length) %
      candidates.length;
    const candidate = candidates[index];
    if (candidate?.isAlive === true) return candidate.id;
  }

  return undefined;
};

/** 현재 대상이 살아 있으면 유지하고, 쓰러졌으면 다음 생존 대상으로 넘깁니다. */
export const resolveActiveTargetId = (
  candidates: readonly CombatTargetCandidate[],
  currentId: string | undefined,
): string | undefined => {
  const current = candidates.find((candidate) => candidate.id === currentId);
  if (current?.isAlive === true) return current.id;
  return resolveNextTargetId(candidates, currentId);
};

export type CombatTargetingControllerConfig = Readonly<{
  enemyIds: readonly string[];
  isAlive: (enemyId: string) => boolean;
  onTargetChanged?: (targetId: string | undefined) => void;
}>;

/**
 * Tab으로 적을 순환 지정합니다. 브라우저의 기본 Tab 이동을 막기 위해
 * keydown을 캡처 단계에서 가로채 `preventDefault`를 호출합니다.
 */
export class CombatTargetingController {
  private readonly enemyIds: readonly string[];
  private readonly isAlive: (enemyId: string) => boolean;
  private readonly onTargetChanged: (targetId: string | undefined) => void;
  private currentTargetId: string | undefined;
  private cleanup?: () => void;

  constructor(config: CombatTargetingControllerConfig) {
    this.enemyIds = [...config.enemyIds];
    this.isAlive = config.isAlive;
    this.onTargetChanged = config.onTargetChanged ?? (() => undefined);
    this.currentTargetId = resolveNextTargetId(this.candidates, undefined);
  }

  get targetId(): string | undefined {
    return this.currentTargetId;
  }

  private get candidates(): readonly CombatTargetCandidate[] {
    return this.enemyIds.map((id) => ({ id, isAlive: this.isAlive(id) }));
  }

  cycle(direction: 1 | -1 = 1): string | undefined {
    const next = resolveNextTargetId(
      this.candidates,
      this.currentTargetId,
      direction,
    );
    return this.commit(next);
  }

  /** 지정한 대상이 쓰러졌을 때 다음 생존 대상으로 옮깁니다. */
  refresh(): string | undefined {
    return this.commit(resolveActiveTargetId(this.candidates, this.currentTargetId));
  }

  bind(source?: TargetingKeyboardSource): void {
    this.dispose();
    if (!source) return;

    const keydown = (event: TargetingKeyboardEvent): void => {
      if (event.key !== "Tab") return;
      event.preventDefault?.();
      event.stopPropagation?.();
      this.cycle(event.shiftKey === true ? -1 : 1);
    };

    source.addEventListener("keydown", keydown, { capture: true });
    this.cleanup = () => {
      source.removeEventListener("keydown", keydown, { capture: true });
      this.cleanup = undefined;
    };
  }

  dispose(): void {
    this.cleanup?.();
  }

  private commit(next: string | undefined): string | undefined {
    if (next === this.currentTargetId) return this.currentTargetId;
    this.currentTargetId = next;
    this.onTargetChanged(next);
    return next;
  }
}
