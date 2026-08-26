import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
  type CreateInitialRunStateInput,
  type RunState,
} from "@typing-roguelike/shared";
import {
  clearSavedRun,
  getBrowserRunStorage,
  loadSavedRun,
  saveRunState,
  type RunStorage,
} from "./run-persistence";
import {
  clearRunResumeCheckpoint,
  loadRunResumeCheckpoint,
  saveRunResumeCheckpoint,
  type RunResumeCheckpoint,
} from "./run-resume-checkpoint";

export type RunStateUpdater = (current: Readonly<RunState>) => RunState;

const getStarterWeapon = () => {
  const weapon = EQUIPMENT_CONFIGS.find(
    (equipment) =>
      equipment.slot === "weapon" &&
      equipment.skills.some((skill) => skill.kind === "attack"),
  );

  if (weapon === undefined) {
    throw new Error("No starter weapon with an attack skill is configured.");
  }

  return weapon;
};

const hasEquippedAttackSkill = (runState: Readonly<RunState>): boolean =>
  [runState.loadout.weaponId, runState.loadout.subweaponId]
    .filter((equipmentId): equipmentId is string => equipmentId !== null)
    .some((equipmentId) =>
      EQUIPMENT_CONFIGS.find((equipment) => equipment.id === equipmentId)?.skills.some(
        (skill) => skill.kind === "attack",
      ) ?? false,
    );

export const ensurePlayableRunLoadout = (runState: Readonly<RunState>): RunState => {
  if (runState.status !== "active" || hasEquippedAttackSkill(runState)) {
    return runState as RunState;
  }

  const starterWeapon = getStarterWeapon();
  const ownsStarter = runState.inventory.itemInstances.includes(starterWeapon.id);

  return {
    ...runState,
    inventory: {
      ...runState.inventory,
      itemInstances: ownsStarter
        ? [...runState.inventory.itemInstances]
        : [...runState.inventory.itemInstances, starterWeapon.id],
    },
    loadout: {
      ...runState.loadout,
      weaponId: starterWeapon.id,
    },
  };
};

export class RunSession {
  private activeRun: RunState | null = null;
  private resumeCheckpoint: RunResumeCheckpoint | null = null;

  constructor(private readonly storage: RunStorage | undefined = getBrowserRunStorage()) {}

  create(input: CreateInitialRunStateInput): RunState {
    if (this.activeRun !== null && this.activeRun.status === "active") {
      throw new Error("An active run already exists.");
    }

    this.resumeCheckpoint = null;
    clearRunResumeCheckpoint(this.storage);
    const next = ensurePlayableRunLoadout(createInitialRunState(input));
    this.activeRun = next;
    saveRunState(next, this.storage);
    return next;
  }

  restore(): Readonly<RunState> | null {
    const restored = loadSavedRun(this.storage);
    if (restored === null) {
      this.activeRun = null;
      this.resumeCheckpoint = null;
      clearRunResumeCheckpoint(this.storage);
      return null;
    }

    const playable = ensurePlayableRunLoadout(restored);
    this.activeRun = playable;
    this.resumeCheckpoint = loadRunResumeCheckpoint(this.storage);
    if (playable.status === "active") {
      saveRunState(playable, this.storage);
    }
    return playable;
  }

  get(): Readonly<RunState> | null {
    return this.activeRun;
  }

  require(): Readonly<RunState> {
    if (this.activeRun === null) {
      throw new Error("No run session is active.");
    }
    return this.activeRun;
  }

  getCheckpoint(): RunResumeCheckpoint | null {
    return this.resumeCheckpoint;
  }

  setCheckpoint(checkpoint: RunResumeCheckpoint): void {
    this.resumeCheckpoint = checkpoint;
    saveRunResumeCheckpoint(checkpoint, this.storage);
  }

  clearCheckpoint(): void {
    this.resumeCheckpoint = null;
    clearRunResumeCheckpoint(this.storage);
  }

  update(updater: RunStateUpdater): Readonly<RunState> {
    const current = this.require();
    if (current.status !== "active") {
      throw new Error("Finished runs cannot be updated.");
    }

    const next = ensurePlayableRunLoadout(updater(current));
    this.activeRun = next;
    if (next.status === "active") saveRunState(next, this.storage);
    else {
      clearSavedRun(this.storage);
      this.clearCheckpoint();
    }
    return next;
  }

  end(status: Exclude<RunState["status"], "active">): Readonly<RunState> {
    const current = this.require();
    if (current.status !== "active") {
      throw new Error("Run has already ended.");
    }

    this.activeRun = { ...current, status };
    clearSavedRun(this.storage);
    this.clearCheckpoint();
    return this.activeRun;
  }

  clear(): void {
    this.activeRun = null;
    clearSavedRun(this.storage);
    this.clearCheckpoint();
  }
}

export const runSession = new RunSession();
