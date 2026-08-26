import Phaser from "phaser";
import { MENU_SETTINGS_REGISTRY_KEYS, type CommandLanguage } from "../scenes/menu-settings";
import type {
  CommandInputSnapshot,
  CommandInputStatus,
} from "../input/command-input-buffer";

export type CommandHudFeedback = Readonly<{
  type: "skill-started";
  command: string;
}>;

export type CommandHudEffect = Readonly<{
  id: string;
  name: string;
  description: string;
  durationMs: number | null;
  remainingMs: number | null;
  placeholderTextureKey: "command-effect-placeholder";
}>;

export type CommandHudState = Readonly<{
  commands: readonly string[];
  command: string;
  input: string;
  status: CommandInputStatus;
  matchedLength: number;
  feedback: CommandHudFeedback | null;
}>;

export type CommandHudCharacterState = "matched" | "incorrect" | "pending";
export type CommandHudCharacter = Readonly<{ value: string; state: CommandHudCharacterState }>;

type CommandHudPresentation = Readonly<{ labelKo: string; labelEn: string; color: string; accent: number }>;

type SkillEffectLike =
  | Readonly<{ type: "damage"; coefficient: number }>
  | Readonly<{ type: "guard"; damageMultiplier: number; durationMs: number }>
  | Readonly<{ type: "status"; statusId: string; durationMs: number; stacks?: number }>;

type SkillLike = Readonly<{
  id: string;
  name: string;
  command: string;
  description: string;
  effects?: readonly SkillEffectLike[];
}>;

type TimedApEffectLike = Readonly<{
  id: "temporary-ap-regeneration";
  amountPerSecond: number;
  durationMs: number;
  remainingMs: number;
}>;

type EffectAwareScene = Phaser.Scene & Readonly<{
  combatInitialization?: Readonly<{
    player: Readonly<{ skills: readonly SkillLike[] }>;
  }>;
  actionPoints?: Readonly<{
    snapshot: Readonly<{ timedEffects?: readonly TimedApEffectLike[] }>;
  }>;
}>;

type EffectVisual = Readonly<{
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  darkness: Phaser.GameObjects.Rectangle;
  darknessMask: Phaser.Display.Masks.GeometryMask;
  hitArea: Phaser.GameObjects.Zone;
}>;

const PRESENTATION_BY_STATUS: Record<CommandInputStatus, CommandHudPresentation> = {
  idle: { labelKo: "커맨드 입력", labelEn: "COMMAND INPUT", color: "#cbd5e1", accent: 0x64748b },
  composing: { labelKo: "입력 조합 중", labelEn: "COMPOSING", color: "#fbbf24", accent: 0xd97706 },
  matching: { labelKo: "입력 진행", labelEn: "MATCHING", color: "#5eead4", accent: 0x14b8a6 },
  incorrect: { labelKo: "오입력", labelEn: "INCORRECT", color: "#fb7185", accent: 0xe11d48 },
  complete: { labelKo: "스킬 시작", labelEn: "SKILL START", color: "#fcd34d", accent: 0xf59e0b },
};

const EFFECT_SIZE = 30;
const EFFECT_GAP = 6;
const EFFECT_TOP = 8;
const EFFECT_LEFT = 8;
const EFFECT_RADIUS = 7;
const PLACEHOLDER_TEXTURE_KEY = "command-effect-placeholder" as const;

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(Math.max(value, minimum), maximum);

export function formatAvailableCommands(commands: readonly string[]): string {
  return commands.join(", ");
}

export function getEffectDarknessRatio(effect: Pick<CommandHudEffect, "durationMs" | "remainingMs">): number {
  if (effect.durationMs === null || effect.remainingMs === null || effect.durationMs <= 0) return 0;
  const remainingRatio = clamp(effect.remainingMs / effect.durationMs, 0, 1);
  return 1 - remainingRatio;
}

export function formatEffectRemainingTime(remainingMs: number | null): string {
  if (remainingMs === null) return "지속시간: 발동 시 적용";
  if (remainingMs >= 1_000) return `남은 시간: ${(remainingMs / 1_000).toFixed(1)}초`;
  return `남은 시간: ${Math.ceil(Math.max(0, remainingMs))}ms`;
}

export function createSkillCommandEffects(skill: SkillLike | undefined): CommandHudEffect[] {
  if (skill === undefined) return [];
  return (skill.effects ?? []).flatMap((effect, index) => {
    if (effect.type === "damage") return [];
    if (effect.type === "guard") {
      const reduction = Math.round((1 - effect.damageMultiplier) * 100);
      return [{
        id: `${skill.id}:guard:${index}`,
        name: "피해 감소",
        description: `${skill.name}: 받는 피해 ${reduction}% 감소 · ${effect.durationMs / 1_000}초`,
        durationMs: effect.durationMs,
        remainingMs: null,
        placeholderTextureKey: PLACEHOLDER_TEXTURE_KEY,
      }];
    }
    return [{
      id: `${skill.id}:status:${effect.statusId}:${index}`,
      name: effect.statusId,
      description: `${skill.name}: ${effect.statusId} ${effect.stacks ?? 1}중첩 · ${effect.durationMs / 1_000}초`,
      durationMs: effect.durationMs,
      remainingMs: null,
      placeholderTextureKey: PLACEHOLDER_TEXTURE_KEY,
    }];
  });
}

export function createTimedApCommandEffects(effects: readonly TimedApEffectLike[] = []): CommandHudEffect[] {
  return effects.map((effect, index) => ({
    id: `${effect.id}:${index}`,
    name: effect.amountPerSecond >= 0 ? "AP 재생 증가" : "AP 재생 감소",
    description: `AP 재생 ${effect.amountPerSecond >= 0 ? "+" : ""}${effect.amountPerSecond}/초`,
    durationMs: effect.durationMs,
    remainingMs: effect.remainingMs,
    placeholderTextureKey: PLACEHOLDER_TEXTURE_KEY,
  }));
}

export function createCommandHudState(snapshot: CommandInputSnapshot): CommandHudState {
  return {
    commands: [...snapshot.commands],
    command: snapshot.command,
    input: snapshot.input,
    status: snapshot.status,
    matchedLength: snapshot.matchedLength,
    feedback: null,
  };
}

export function updateCommandHudState(state: CommandHudState, snapshot: CommandInputSnapshot): CommandHudState {
  return {
    ...state,
    commands: [...snapshot.commands],
    command: snapshot.command,
    input: snapshot.input,
    status: snapshot.status,
    matchedLength: snapshot.matchedLength,
    feedback: snapshot.status === "complete" ? state.feedback : null,
  };
}

export function markSkillStarted(state: CommandHudState): CommandHudState {
  return { ...state, feedback: { type: "skill-started", command: state.command } };
}

export function getCommandHudCharacters(state: CommandHudState): CommandHudCharacter[] {
  const commandCharacters = Array.from(state.command);
  const matchedLength = clamp(state.matchedLength, 0, commandCharacters.length);
  return commandCharacters.map((value, index) => ({
    value,
    state: index < matchedLength ? "matched" : state.status === "incorrect" && index === matchedLength ? "incorrect" : "pending",
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
  private readonly tooltipBackground: Phaser.GameObjects.Rectangle;
  private readonly tooltipText: Phaser.GameObjects.Text;
  private readonly effectVisuals: EffectVisual[] = [];
  private readonly scene: Phaser.Scene;
  private state: CommandHudState;
  private panelWidth = 420;
  private panelHeight = 152;
  private hoveredEffectId: string | null = null;

  constructor(scene: Phaser.Scene, initialSnapshot: CommandInputSnapshot) {
    this.scene = scene;
    this.state = createCommandHudState(initialSnapshot);
    this.container = scene.add.container(0, 0);
    this.panel = scene.add.rectangle(0, 0, this.panelWidth, this.panelHeight, 0x0b1220, 0.94).setOrigin(0).setStrokeStyle(2, 0x64748b, 0.95);
    this.title = scene.add.text(18, 10, "COMMAND // AVAILABLE", { color: "#94a3b8", fontFamily: "Galmuri9, monospace", fontSize: "13px" });
    this.commandText = scene.add.text(18, 30, "", { color: "#f8fafc", fontFamily: "Galmuri9, monospace", fontSize: "18px", lineSpacing: 2 });
    this.inputText = scene.add.text(18, 76, "", { color: "#cbd5e1", fontFamily: "Galmuri9, monospace", fontSize: "16px" });
    this.statusText = scene.add.text(18, 104, "", { color: "#cbd5e1", fontFamily: "Galmuri9, monospace", fontSize: "13px" });
    this.progressTrack = scene.add.rectangle(18, 128, 190, 8, 0x1e293b, 1).setOrigin(0, 0.5);
    this.progressFill = scene.add.rectangle(18, 128, 1, 8, 0x14b8a6, 1).setOrigin(0, 0.5);
    this.feedbackText = scene.add.text(226, 104, "", { color: "#fcd34d", fontFamily: "Galmuri9, monospace", fontSize: "13px" });
    this.tooltipBackground = scene.add.rectangle(0, 0, 220, 64, 0x020617, 0.98).setOrigin(0).setStrokeStyle(1, 0x94a3b8, 0.9).setVisible(false);
    this.tooltipText = scene.add.text(0, 0, "", { color: "#f8fafc", fontFamily: "Galmuri9, monospace", fontSize: "11px", lineSpacing: 4, wordWrap: { width: 196, useAdvancedWrap: true } }).setVisible(false);
    this.container.add([this.panel, this.title, this.commandText, this.inputText, this.statusText, this.progressTrack, this.progressFill, this.feedbackText, this.tooltipBackground, this.tooltipText]);
    this.container.setSize(this.panelWidth, this.panelHeight);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.refreshEffects, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.release, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.release, this);
    this.refresh();
  }

  setPosition(x: number, y: number): void { this.container.setPosition(x, y); }
  setSize(width: number, height: number): void {
    this.panelWidth = Math.max(260, width);
    this.panelHeight = Math.max(132, height);
    this.panel.setSize(this.panelWidth, this.panelHeight);
    this.container.setSize(this.panelWidth, this.panelHeight);
    this.refresh();
  }
  update(snapshot: CommandInputSnapshot): void { this.state = updateCommandHudState(this.state, snapshot); this.refresh(); }
  showSkillStarted(): void { this.state = markSkillStarted(this.state); this.refresh(); }
  getState(): CommandHudState { return { ...this.state, commands: [...this.state.commands], feedback: this.state.feedback ? { ...this.state.feedback } : null }; }
  getEffects(): readonly CommandHudEffect[] { return this.resolveEffects(); }

  private getLanguage(): CommandLanguage {
    return this.scene.registry.get(MENU_SETTINGS_REGISTRY_KEYS.commandLanguage) === "en" ? "en" : "ko";
  }

  private resolveEffects(): CommandHudEffect[] {
    const effectScene = this.scene as EffectAwareScene;
    const currentSkill = effectScene.combatInitialization?.player.skills.find((skill) => skill.command === this.state.command);
    const skillEffects = createSkillCommandEffects(currentSkill);
    const timedApEffects = createTimedApCommandEffects(effectScene.actionPoints?.snapshot.timedEffects);
    return [...skillEffects, ...timedApEffects];
  }

  private refreshEffects(): void {
    const effects = this.resolveEffects();
    for (let index = 0; index < effects.length; index += 1) {
      const effect = effects[index]!;
      const visual = this.getOrCreateEffectVisual(index);
      const x = EFFECT_LEFT + index * (EFFECT_SIZE + EFFECT_GAP);
      const darknessHeight = EFFECT_SIZE * getEffectDarknessRatio(effect);
      visual.container.setPosition(x, EFFECT_TOP).setVisible(true).setActive(true);
      visual.darkness.setPosition(0, EFFECT_SIZE - darknessHeight).setSize(EFFECT_SIZE, darknessHeight);
      visual.hitArea.setData("effectId", effect.id);
      visual.hitArea.setData("effect", effect);
    }
    for (let index = effects.length; index < this.effectVisuals.length; index += 1) {
      this.effectVisuals[index]!.container.setVisible(false).setActive(false);
    }

    const hovered = effects.find((effect) => effect.id === this.hoveredEffectId);
    if (hovered === undefined) {
      this.hideTooltip();
      return;
    }
    this.showTooltip(hovered, effects.findIndex((effect) => effect.id === hovered.id));
  }

  private getOrCreateEffectVisual(index: number): EffectVisual {
    const existing = this.effectVisuals[index];
    if (existing !== undefined) return existing;

    const effectContainer = this.scene.add.container(0, 0).setDepth(20);
    const frame = this.scene.add.graphics();
    frame.fillStyle(0x1e293b, 1);
    frame.fillRoundedRect(0, 0, EFFECT_SIZE, EFFECT_SIZE, EFFECT_RADIUS);
    frame.lineStyle(2, 0x94a3b8, 0.95);
    frame.strokeRoundedRect(0, 0, EFFECT_SIZE, EFFECT_SIZE, EFFECT_RADIUS);

    const maskShape = this.scene.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRoundedRect(0, 0, EFFECT_SIZE, EFFECT_SIZE, EFFECT_RADIUS);
    const darknessMask = maskShape.createGeometryMask();
    const darkness = this.scene.add.rectangle(0, EFFECT_SIZE, EFFECT_SIZE, 0, 0x000000, 0.68).setOrigin(0).setMask(darknessMask);
    const hitArea = this.scene.add.zone(0, 0, EFFECT_SIZE, EFFECT_SIZE).setOrigin(0).setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => {
      const effect = hitArea.getData("effect") as CommandHudEffect | undefined;
      if (effect === undefined) return;
      this.hoveredEffectId = effect.id;
      this.showTooltip(effect, index);
    });
    hitArea.on("pointerout", () => {
      this.hoveredEffectId = null;
      this.hideTooltip();
    });

    effectContainer.add([frame, darkness, hitArea]);
    this.container.add(effectContainer);
    this.container.bringToTop(this.tooltipBackground);
    this.container.bringToTop(this.tooltipText);
    const visual = { container: effectContainer, frame, darkness, darknessMask, hitArea };
    this.effectVisuals.push(visual);
    return visual;
  }

  private showTooltip(effect: CommandHudEffect, index: number): void {
    const tooltipWidth = 220;
    const x = clamp(EFFECT_LEFT + index * (EFFECT_SIZE + EFFECT_GAP), 8, Math.max(8, this.panelWidth - tooltipWidth - 8));
    const label = `${effect.name}\n${effect.description}\n${formatEffectRemainingTime(effect.remainingMs)}`;
    this.tooltipText.setText(label).setPosition(x + 12, EFFECT_TOP + EFFECT_SIZE + 13).setVisible(true);
    const tooltipHeight = Math.max(64, this.tooltipText.height + 20);
    this.tooltipBackground.setPosition(x, EFFECT_TOP + EFFECT_SIZE + 7).setSize(tooltipWidth, tooltipHeight).setVisible(true);
    this.container.bringToTop(this.tooltipBackground);
    this.container.bringToTop(this.tooltipText);
  }

  private hideTooltip(): void {
    this.tooltipBackground.setVisible(false);
    this.tooltipText.setVisible(false);
  }

  private release(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.refreshEffects, this);
    for (const visual of this.effectVisuals) visual.darknessMask.destroy();
  }

  private refresh(): void {
    const language = this.getLanguage();
    const presentation = PRESENTATION_BY_STATUS[this.state.status];
    const commandCharacters = getCommandHudCharacters(this.state);
    const commandLength = commandCharacters.length;
    const matchedLength = clamp(this.state.matchedLength, 0, Math.max(0, commandLength));
    const progressWidth = Math.max(100, Math.min(190, this.panelWidth - 36));
    const progressRatio = commandLength === 0 ? 0 : matchedLength / commandLength;
    const isCompact = this.panelWidth < 620;
    const commandFontSize = this.panelWidth < 380 ? 12 : isCompact ? 14 : 18;
    const effectCount = this.resolveEffects().length;
    const contentLeft = effectCount > 0 ? Math.min(18 + effectCount * (EFFECT_SIZE + EFFECT_GAP), Math.max(18, this.panelWidth - 180)) : 18;

    this.panel.setStrokeStyle(2, presentation.accent, 0.95);
    this.title.setX(contentLeft);
    this.commandText
      .setPosition(contentLeft, 30)
      .setFontSize(commandFontSize)
      .setWordWrapWidth(Math.max(120, this.panelWidth - contentLeft - 18), true)
      .setText(formatAvailableCommands(this.state.commands))
      .setColor("#f8fafc");

    const listBottom = 30 + this.commandText.height;
    const inputY = Math.min(
      Math.max(58, listBottom + 5),
      Math.max(58, this.panelHeight - 58),
    );
    const statusY = Math.min(inputY + 23, this.panelHeight - 33);
    const progressY = Math.min(statusY + 23, this.panelHeight - 12);

    const inputPrefix = language === "ko" ? "입력" : "INPUT";
    this.inputText
      .setPosition(18, inputY)
      .setText(this.state.input.length > 0 ? `${inputPrefix}: ${this.state.input}` : `${inputPrefix}: —`)
      .setColor(presentation.color);

    const activePrefix = language === "ko" ? "활성" : "ACTIVE";
    const statusLabel = language === "ko" ? presentation.labelKo : presentation.labelEn;
    this.statusText
      .setPosition(18, statusY)
      .setText(`${activePrefix}: ${this.state.command} · ${statusLabel} ${matchedLength}/${commandLength}`)
      .setColor(presentation.color);

    this.progressTrack.setPosition(18, progressY).setSize(progressWidth, 8);
    this.progressFill.setPosition(18, progressY).setSize(progressWidth * progressRatio, 8).setFillStyle(presentation.accent, 1);
    this.feedbackText
      .setText(this.state.feedback?.type === "skill-started" ? `[SKILL START] ${this.state.feedback.command}` : "")
      .setColor(presentation.color)
      .setPosition(
        isCompact ? Math.max(18, this.panelWidth - 210) : Math.max(218, this.panelWidth - 194),
        isCompact ? 10 : statusY,
      );
    this.refreshEffects();
  }
}
