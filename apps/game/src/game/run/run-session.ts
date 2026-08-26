import { createInitialRunState, type CreateInitialRunStateInput, type RunState } from "@typing-roguelike/shared";

export type RunStateUpdater = (current: Readonly<RunState>) => RunState;

export class RunSession {
  private activeRun: RunState | null = null;

  create(input: CreateInitialRunStateInput): RunState {
    if (this.activeRun !== null && this.activeRun.status === "active") {
      throw new Error("An active run already exists.");
    }

    const next = createInitialRunState(input);
    this.activeRun = next;
    return next;
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
    return next;
  }

  end(status: Exclude<RunState["status"], "active">): Readonly<RunState> {
    const current = this.require();
    if (current.status !== "active") {
      throw new Error("Run has already ended.");
    }

    this.activeRun = { ...current, status };
    return this.activeRun;
  }

  clear(): void {
    this.activeRun = null;
  }
}

export const runSession = new RunSession();
