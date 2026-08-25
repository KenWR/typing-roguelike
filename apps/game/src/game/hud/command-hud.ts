import Phaser from "phaser";
import type {
  CommandInputSnapshot,
  CommandInputStatus,
} from "../input/command-input-buffer";

export type CommandHudFeedback = Readonly<{
  type: "skill-started";
  command: string;
}>;

export type CommandHudState = Readonly<{
  command: string;
  input: string;
  status: CommandInputStatus;
  matchedLength: number;
  feedback: CommandHudFeedback | null;
}>;

export type CommandHudCharacterState = "matched" | "incorrect" | "pending";

export type CommandHudCharacter = Readonly<{
  value: string;
  state: CommandHudCharacterState;
}>;

type CommandHudPresentation = Readonly<{
  label: string;
  color: string;
  accent: number;
}>;

const PRESENTATION_BY_STATUS: Record<
  CommandInputStatus,
  CommandHudPresentation
> = {
  idle: { label: "커맨드 입력", color: "#cbd5e1", accent: 0x64748b },
  composing: { label: "입력 조합 중", color: "#fbbf24", accent: 0xd97706 },
  matching: { label: "입력 진행", color: "#5eead4", accent: 0x14b8a6 },
  incorrect: { label: "오입력", color: "#fb7185", accent: 0xe11d48 },
  complete: { label: "스킬 시작", color: "#fcd34d", accent: 0xf59e0b },
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export function createCommandHudState(
  snapshot: CommandInputSnapshot,
): CommandHudState {
  return {
    command: snapshot.command,
    input: snapshot.input,
    status: snapshot.status,
    matchedLength: snapshot.matchedLength,
    feedback: null,
  };
}

export function updateCommandHudState(
  state: CommandHudState,
  snapshot: CommandInputSnapshot,
): CommandHudState {
  return {
    ...state,
    command: snapshot.command,
    input: snapshot.input,
    status: snapshot.status,
    matchedLength: snapshot.matchedLength,
    feedback: snapshot.status === "complete" ? state.feedback : null,
  };
}

export function markSkillStarted(state: CommandHudState): CommandHudState {
  return {
    ...state,
    feedback: {
      type: "skill-started",
      command: state.command,
    },
  };
}

export function getCommandHudCharacters(
  state: CommandHudState,
): CommandHudCharacter[] {
  const commandCharacters = Array.from(state.command);
  const matchedLength = clamp(state.matchedLength, 0, commandCharacters.length);

  return commandCharacters.map((value, index) => ({
    value,
    state:
      index < matchedLength
        ? "matched"
        : state.status === "incorrect" && index === matchedLength
          ? "incorrect"
          : "pending",
  }));
}

export class CommandHud {
  readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly commandText: Phaser.GameObjects.Text;
  private readonly inputText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly progressTrack: Phaser.GameObjects.Rectangle;
  private readonly progressFill: Phaser.GameObjects.Rectangle;
  private readonly feedbackText: Phaser.GameObjects.Text;
  private state: CommandHudState;
  private panelWidth = 420;
  private panelHeight = 152;

  constructor(scene: Phaser.Scene, initialSnapshot: CommandInputSnapshot) {
    this.state = createCommandHudState(initialSnapshot);
    this.container = scene.add.container(0, 0);

    this.panel = scene.add
      .rectangle(0, 0, this.panelWidth, this.panelHeight, 0x0b1220, 0.94)
      .setOrigin(0)
      .setStrokeStyle(2, 0x64748b, 0.95);
    this.title = scene.add.text(18, 12, "COMMAND // INPUT", {
      color: "#94a3b8",
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
    });
    this.commandText = scene.add.text(18, 34, "", {
      color: "#f8fafc",
      fontFamily: "Galmuri9, monospace",
      fontSize: "28px",
    });
    this.inputText = scene.add.text(18, 76, "", {
      color: "#cbd5e1",
      fontFamily: "Galmuri9, monospace",
      fontSize: "17px",
    });
    this.statusText = scene.add.text(18, 104, "", {
      color: "#cbd5e1",
      fontFamily: "Galmuri9, monospace",
      fontSize: "14px",
    });
    this.progressTrack = scene.add
      .rectangle(18, 128, 190, 8, 0x1e293b, 1)
      .setOrigin(0, 0.5);
    this.progressFill = scene.add
      .rectangle(18, 128, 1, 8, 0x14b8a6, 1)
      .setOrigin(0, 0.5);
    this.feedbackText = scene.add.text(226, 104, "", {
      color: "#fcd34d",
      fontFamily: "Galmuri9, monospace",
      fontSize: "14px",
    });

    this.container.add([
      this.panel,
      this.title,
      this.commandText,
      this.inputText,
      this.statusText,
      this.progressTrack,
      this.progressFill,
      this.feedbackText,
    ]);
    this.container.setSize(this.panelWidth, this.panelHeight);
    this.refresh();
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setSize(width: number, height: number): void {
    this.panelWidth = Math.max(260, width);
    this.panelHeight = Math.max(132, height);
    this.panel.setSize(this.panelWidth, this.panelHeight);
    this.container.setSize(this.panelWidth, this.panelHeight);
    this.refresh();
  }

  update(snapshot: CommandInputSnapshot): void {
    this.state = updateCommandHudState(this.state, snapshot);
    this.refresh();
  }

  showSkillStarted(): void {
    this.state = markSkillStarted(this.state);
    this.refresh();
  }

  getState(): CommandHudState {
    return {
      ...this.state,
      feedback: this.state.feedback ? { ...this.state.feedback } : null,
    };
  }

  private refresh(): void {
    const presentation = PRESENTATION_BY_STATUS[this.state.status];
    const commandCharacters = getCommandHudCharacters(this.state);
    const commandLength = commandCharacters.length;
    const matchedLength = clamp(
      this.state.matchedLength,
      0,
      Math.max(0, commandLength),
    );
    const progressWidth = 190;
    const progressRatio = commandLength === 0 ? 0 : matchedLength / commandLength;

    this.panel.setStrokeStyle(2, presentation.accent, 0.95);
    this.commandText
      .setText(this.state.command)
      .setColor(
        this.state.status === "incorrect" ? "#fb7185" : "#f8fafc",
      );
    this.inputText
      .setText(this.state.input.length > 0 ? `입력: ${this.state.input}` : "입력: —")
      .setColor(presentation.color);
    this.statusText.setText(
      `${presentation.label}  ${matchedLength}/${commandLength}`,
    );
    this.statusText.setColor(presentation.color);
    this.progressTrack.setSize(progressWidth, 8);
    this.progressFill
      .setSize(progressWidth * progressRatio, 8)
      .setFillStyle(presentation.accent, 1);
    this.feedbackText
      .setText(
        this.state.feedback?.type === "skill-started"
          ? `[SKILL START] ${this.state.feedback.command}`
          : "",
      )
      .setColor(presentation.color);

    const isCompact = this.panelWidth < 620;
    const feedbackX = isCompact ? 18 : Math.max(218, this.panelWidth - 194);
    const feedbackY = isCompact ? Math.min(this.panelHeight - 20, 148) : 104;
    this.feedbackText.setPosition(feedbackX, feedbackY);
    this.title.setColor("#94a3b8");
  }
}
