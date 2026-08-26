import { createInitialRunState, type CreateInitialRunStateInput, type RunState } from "@typing-roguelike/shared";
import {
  clearSavedRun,
  getBrowserRunStorage,
  loadSavedRun,
  saveRunState,
  type RunStorage,
} from "./run-persistence";

export type RunStateUpdater = (current: Readonly<RunState>) => RunState;

export class RunSession {
  private activeRun: RunState | null = null;

  constructor(private readonly storage: RunStorage | undefined = getBrowserRunStorage()) {}

  create(input: CreateInitialRunStateInput): RunState {
    if (this.activeRun !== null && this.activeRun.status === "active") {
      throw new Error("An active run already exists.");
    }

    const next = createInitialRunState(input);
    this.activeRun = next;
    saveRunState(next, this.storage);
    return next;
  }

  restore(): Readonly<RunState> | null {
    const restored = loadSavedRun(this.storage);
    this.activeRun = restored;
    return restored;
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

  update(updater: RunStateUpdater): Readonly<RunState> {
    const current = this.require();
    if (current.status !== "active") {
      throw new Error("Finished runs cannot be updated.");
    }

    const next = updater(current);
    this.activeRun = next;
    if (next.status === "active") saveRunState(next, this.storage);
    else clearSavedRun(this.storage);
    return next;
  }

  end(status: Exclude<RunState["status"], "active">): Readonly<RunState> {
    const current = this.require();
    if (current.status !== "active") {
      throw new Error("Run has already ended.");
    }

    this.activeRun = { ...current, status };
    clearSavedRun(this.storage);
    return this.activeRun;
  }

  clear(): void {
    this.activeRun = null;
    clearSavedRun(this.storage);
  }
}

export const runSession = new RunSession();
