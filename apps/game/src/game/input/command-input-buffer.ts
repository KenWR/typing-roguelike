export type CommandInputStatus =
  | "idle"
  | "composing"
  | "matching"
  | "incorrect"
  | "complete";

export type CommandInputSnapshot = Readonly<{
  command: string;
  input: string;
  committedInput: string;
  status: CommandInputStatus;
  matchedLength: number;
}>;

export type CommandCompletedEvent = Readonly<{
  command: string;
  input: string;
}>;

export type CommandStatusChangedEvent = Readonly<{
  previousStatus: CommandInputStatus;
  snapshot: CommandInputSnapshot;
}>;

export type CommandCompletedListener = (event: CommandCompletedEvent) => void;
export type CommandStatusChangedListener = (
  event: CommandStatusChangedEvent,
) => void;

export type UpdateInputOptions = Readonly<{
  isComposing?: boolean;
}>;

const normalizeForMatching = (value: string): string => value.normalize("NFC");

export class CommandInputBuffer {
  private command: string;
  private input = "";
  private committedInput = "";
  private status: CommandInputStatus = "idle";
  private completionEmitted = false;
  private readonly completedListeners = new Set<CommandCompletedListener>();
  private readonly statusChangedListeners = new Set<CommandStatusChangedListener>();

  constructor(command: string) {
    this.command = this.validateCommand(command);
  }

  get snapshot(): CommandInputSnapshot {
    return {
      command: this.command,
      input: this.input,
      committedInput: this.committedInput,
      status: this.status,
      matchedLength: this.getMatchedLength(),
    };
  }

  setCommand(command: string): CommandInputSnapshot {
    this.command = this.validateCommand(command);
    return this.reset();
  }

  appendInput(input: string): CommandInputSnapshot {
    return this.updateInput(this.committedInput + input);
  }

  updateInput(
    input: string,
    options: UpdateInputOptions = {},
  ): CommandInputSnapshot {
    this.input = input;

    if (options.isComposing) {
      this.updateStatus("composing");
      return this.snapshot;
    }

    this.committedInput = input;
    this.updateStatus(this.resolveStatus(input));

    if (this.status === "complete" && !this.completionEmitted) {
      this.completionEmitted = true;
      this.emitCompleted();
    }

    return this.snapshot;
  }

  reset(): CommandInputSnapshot {
    this.input = "";
    this.committedInput = "";
    this.completionEmitted = false;
    this.updateStatus("idle");
    return this.snapshot;
  }

  onCompleted(listener: CommandCompletedListener): () => void {
    this.completedListeners.add(listener);
    return () => {
      this.completedListeners.delete(listener);
    };
  }

  onStatusChanged(listener: CommandStatusChangedListener): () => void {
    this.statusChangedListeners.add(listener);
    return () => {
      this.statusChangedListeners.delete(listener);
    };
  }

  private validateCommand(command: string): string {
    if (normalizeForMatching(command).length === 0) {
      throw new RangeError("Command must not be empty.");
    }

    return command;
  }

  private resolveStatus(input: string): CommandInputStatus {
    const normalizedInput = normalizeForMatching(input);
    const normalizedCommand = normalizeForMatching(this.command);

    if (normalizedInput.length === 0) {
      return "idle";
    }

    if (normalizedInput === normalizedCommand) {
      return "complete";
    }

    return normalizedCommand.startsWith(normalizedInput)
      ? "matching"
      : "incorrect";
  }

  private getMatchedLength(): number {
    const normalizedInput = normalizeForMatching(this.input);
    const normalizedCommand = normalizeForMatching(this.command);
    const comparableLength = Math.min(
      normalizedInput.length,
      normalizedCommand.length,
    );

    let matchedLength = 0;
    while (
      matchedLength < comparableLength &&
      normalizedInput[matchedLength] === normalizedCommand[matchedLength]
    ) {
      matchedLength += 1;
    }

    return matchedLength;
  }

  private updateStatus(nextStatus: CommandInputStatus): void {
    if (nextStatus === this.status) {
      return;
    }

    const previousStatus = this.status;
    this.status = nextStatus;
    const event: CommandStatusChangedEvent = {
      previousStatus,
      snapshot: this.snapshot,
    };

    for (const listener of this.statusChangedListeners) {
      listener(event);
    }
  }

  private emitCompleted(): void {
    const event: CommandCompletedEvent = {
      command: this.command,
      input: this.committedInput,
    };

    for (const listener of this.completedListeners) {
      listener(event);
    }
  }
}
