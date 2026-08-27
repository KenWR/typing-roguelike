export type CommandInputStatus = "idle" | "composing" | "matching" | "incorrect" | "complete";

export type CommandInputSnapshot = Readonly<{
  commands: readonly string[];
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
export type CommandSubmittedEvent = Readonly<{
  snapshot: CommandInputSnapshot;
}>;
export type CommandSubmittedListener = (event: CommandSubmittedEvent) => void;
export type CommandStatusChangedListener = (event: CommandStatusChangedEvent) => void;

export type UpdateInputOptions = Readonly<{
  isComposing?: boolean;
}>;

const normalizeForMatching = (value: string): string => value.normalize("NFC");

export class CommandInputBuffer {
  private commands: readonly string[];
  private command: string;
  private input = "";
  private committedInput = "";
  private status: CommandInputStatus = "idle";
  private completionEmitted = false;
  private boundEnterResetElement: HTMLInputElement | null = null;
  private readonly completedListeners = new Set<CommandCompletedListener>();
  private readonly submittedListeners = new Set<CommandSubmittedListener>();
  private readonly statusChangedListeners = new Set<CommandStatusChangedListener>();

  constructor(commands: string | readonly string[]) {
    this.commands = this.validateCommands(typeof commands === "string" ? [commands] : commands);
    this.command = this.firstCommand();
  }

  get snapshot(): CommandInputSnapshot {
    return {
      commands: [...this.commands],
      command: this.command,
      input: this.input,
      committedInput: this.committedInput,
      status: this.status,
      matchedLength: this.getMatchedLength(),
    };
  }

  setCommand(command: string): CommandInputSnapshot {
    return this.setCommands([command]);
  }

  setCommands(commands: readonly string[]): CommandInputSnapshot {
    this.commands = this.validateCommands(commands);
    this.command = this.firstCommand();
    return this.reset();
  }

  appendInput(input: string): CommandInputSnapshot {
    return this.updateInput(this.committedInput + input);
  }

  updateInput(rawInput: string, options: UpdateInputOptions = {}): CommandInputSnapshot {
    this.bindEnterResetIfAvailable();
    const input = this.prepareInputForNextCycle(rawInput);

    this.input = input;
    this.command = this.resolveActiveCommand(input);

    if (options.isComposing) {
      this.updateStatus("composing");
      return this.snapshot;
    }

    this.committedInput = input;
    this.updateStatus(this.resolveStatus(input));

    return this.snapshot;
  }

  reset(): CommandInputSnapshot {
    this.input = "";
    this.committedInput = "";
    this.command = this.firstCommand();
    this.completionEmitted = false;
    this.updateStatus("idle");
    return this.snapshot;
  }

  /** Submit the current command cycle and then clear it for the next command. */
  submit(): CommandInputSnapshot {
    const submitted = this.snapshot;
    if (submitted.status === "complete" && !this.completionEmitted) {
      this.completionEmitted = true;
      this.emitCompleted();
    }
    for (const listener of this.submittedListeners) {
      listener({ snapshot: submitted });
    }
    return this.reset();
  }

  onCompleted(listener: CommandCompletedListener): () => void {
    this.completedListeners.add(listener);
    return () => {
      this.completedListeners.delete(listener);
    };
  }

  onSubmitted(listener: CommandSubmittedListener): () => void {
    this.submittedListeners.add(listener);
    return () => {
      this.submittedListeners.delete(listener);
    };
  }

  onStatusChanged(listener: CommandStatusChangedListener): () => void {
    this.statusChangedListeners.add(listener);
    return () => {
      this.statusChangedListeners.delete(listener);
    };
  }

  private bindEnterResetIfAvailable(): void {
    if (typeof document === "undefined") return;

    const element = document.getElementById("command-input");
    if (!(element instanceof HTMLInputElement)) return;
    if (this.boundEnterResetElement === element) return;

    this.boundEnterResetElement = element;
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing || this.status === "composing") {
        return;
      }

      event.preventDefault();
      element.value = "";
      this.submit();
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  private prepareInputForNextCycle(rawInput: string): string {
    // A command cycle ends only when the user presses Enter. Keep the raw DOM
    // value intact so long input (including spaces) is never silently dropped.
    return rawInput;
  }

  private validateCommands(commands: readonly string[]): readonly string[] {
    if (commands.length === 0) {
      throw new RangeError("Commands must not be empty.");
    }

    const normalized = new Set<string>();
    const validated = commands.map((command) => {
      const normalizedCommand = normalizeForMatching(command);
      if (normalizedCommand.length === 0) {
        throw new RangeError("Command must not be empty.");
      }
      if (normalized.has(normalizedCommand)) {
        throw new Error(`Duplicate command: ${command}`);
      }
      normalized.add(normalizedCommand);
      return command;
    });

    return validated;
  }

  private firstCommand(): string {
    const command = this.commands[0];
    if (command === undefined) throw new Error("Command list unexpectedly empty.");
    return command;
  }

  private resolveActiveCommand(input: string): string {
    const normalizedInput = normalizeForMatching(input);
    if (normalizedInput.length === 0) {
      return this.firstCommand();
    }

    const exact = this.commands.find((command) => normalizeForMatching(command) === normalizedInput);
    if (exact !== undefined) {
      return exact;
    }

    const prefixMatch = this.commands.find((command) => normalizeForMatching(command).startsWith(normalizedInput));
    if (prefixMatch !== undefined) {
      return prefixMatch;
    }

    let bestCommand = this.firstCommand();
    let bestMatchedLength = -1;
    for (const command of this.commands) {
      const matchedLength = this.getCommonPrefixLength(normalizedInput, normalizeForMatching(command));
      if (matchedLength > bestMatchedLength) {
        bestCommand = command;
        bestMatchedLength = matchedLength;
      }
    }
    return bestCommand;
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

    return normalizedCommand.startsWith(normalizedInput) ? "matching" : "incorrect";
  }

  private getMatchedLength(): number {
    return this.getCommonPrefixLength(normalizeForMatching(this.input), normalizeForMatching(this.command));
  }

  private getCommonPrefixLength(left: string, right: string): number {
    const comparableLength = Math.min(left.length, right.length);
    let matchedLength = 0;
    while (matchedLength < comparableLength && left[matchedLength] === right[matchedLength]) {
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
