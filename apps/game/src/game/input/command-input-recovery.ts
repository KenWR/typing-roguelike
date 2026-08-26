import {
  CommandInputBuffer,
  type CommandInputSnapshot,
  type UpdateInputOptions,
} from "./command-input-buffer";

export type CommandInputRecoveryOutcome =
  | "idle"
  | "composing"
  | "matching"
  | "incorrect"
  | "complete";

export type CommandInputRecoveryResult = Readonly<{
  outcome: CommandInputRecoveryOutcome;
  snapshot: CommandInputSnapshot;
  failedSnapshot: CommandInputSnapshot | null;
  mistakeCount: number;
}>;

export class CommandInputRecoveryController {
  private mistakeCount = 0;

  constructor(private readonly buffer: CommandInputBuffer) {}

  get snapshot(): CommandInputRecoveryResult {
    return {
      outcome: this.buffer.snapshot.status,
      snapshot: this.buffer.snapshot,
      failedSnapshot: null,
      mistakeCount: this.mistakeCount,
    };
  }

  updateInput(
    input: string,
    options: UpdateInputOptions = {},
  ): CommandInputRecoveryResult {
    const next = this.buffer.updateInput(input, options);

    if (next.status !== "incorrect") {
      return {
        outcome: next.status,
        snapshot: next,
        failedSnapshot: null,
        mistakeCount: this.mistakeCount,
      };
    }

    this.mistakeCount += 1;
    const failedSnapshot = next;
    const resetSnapshot = this.buffer.reset();

    return {
      outcome: "incorrect",
      snapshot: resetSnapshot,
      failedSnapshot,
      mistakeCount: this.mistakeCount,
    };
  }

  appendInput(
    input: string,
    options: UpdateInputOptions = {},
  ): CommandInputRecoveryResult {
    return this.updateInput(this.buffer.snapshot.committedInput + input, options);
  }

  setCommand(command: string): CommandInputRecoveryResult {
    const snapshot = this.buffer.setCommand(command);
    return {
      outcome: snapshot.status,
      snapshot,
      failedSnapshot: null,
      mistakeCount: this.mistakeCount,
    };
  }

  resetMistakes(): void {
    this.mistakeCount = 0;
  }
}
