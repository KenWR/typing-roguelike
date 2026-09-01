import type Phaser from "phaser";
import { resolveEffectTextureKey } from "../assets/effect-visual-assets";
import { RING_CONFIGS, type RingSkillModifier } from "@typing-roguelike/shared";
import { MENU_SETTINGS_REGISTRY_KEYS, type CommandLanguage } from "../scenes/menu-settings";
import type { CommandInputSnapshot, CommandInputStatus } from "../input/command-input-buffer";
import {
  EFFECT_PLACEHOLDER_TEXTURE_KEY,
  formatEffectRemainingTime,
  getEffectDarknessRatio,
} from "./effect-presentation";

export { formatEffectRemainingTime, getEffectDarknessRatio } from "./effect-presentation";

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
  textureKey: string;
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
export type CommandHudSegments = Readonly<{
  prefix?: string;
  baseCommand: string;
  suffix?: string;
}>;

type CommandHudPresentation = Readonly<{ labelKo: string; labelEn: string; color: string; accent: number }>;

type SkillEffectLike =
  | Readonly<{ type: "damage"; coefficient: number }>
  | Readonly<{ type: "guard"; damageMultiplier: number; durationMs: number }>
  | Readonly<{ type: "shield"; amount: number; durationMs: number }>
  | Readonly<{ type: "status"; statusId: string; durationMs: number; stacks?: number }>;

type SkillLike = Readonly<{
  id: string;
  name: string;
  command: string;
  description: string;
  category?: "basic" | "special" | "guard";
  apCost?: number;
  effects?: readonly SkillEffectLike[];
}>;

type SkillPreviewInput = Readonly<{
  name: string;
  category: "basic" | "special" | "guard";
  apCost: number;
  command?: string;
}>;
type SkillPreviewSkill = SkillLike & SkillPreviewInput;

export type CommandHudOptions = Readonly<{
  skills?: readonly SkillPreviewSkill[];
  resolveApCost?: (skill: SkillPreviewInput) => number;
  resolveDamage?: (skill: SkillPreviewInput) => number | null;
}>;

type TimedApEffectLike = Readonly<{
  id: "temporary-ap-regeneration";
  amountPerSecond: number;
  durationMs: number;
  remainingMs: number;
}>;

type EffectAwareScene = Phaser.Scene &
  Readonly<{
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
  icon: Phaser.GameObjects.Image;
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
const MISSING_ASSET_TEXTURE_KEY = EFFECT_PLACEHOLDER_TEXTURE_KEY;
const effectTextureKey = (effectId: string): string => resolveEffectTextureKey(effectId) ?? MISSING_ASSET_TEXTURE_KEY;
const SCENE_UPDATE_EVENT = "update";
const SCENE_SHUTDOWN_EVENT = "shutdown";
const SCENE_DESTROY_EVENT = "destroy";
const POINTER_OVER_EVENT = "pointerover";

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(Math.max(value, minimum), maximum);

const HUD_COPY = {
  ko: {
    header: "유형 // 명령어 // 비용 // 피해",
    basicSkill: "기본기술",
    specialSkill: "특수기술",
    prefix: "접두사",
    command: "명령어",
    suffix: "접미사",
    damage: "데미지",
    windup: "선딜",
    inflict: "부여",
  },
  en: {
    header: "TYPE // COMMAND // COST // DAMAGE",
    basicSkill: "BASIC SKILL",
    specialSkill: "SPECIAL SKILL",
    prefix: "PREFIX",
    command: "COMMAND",
    suffix: "SUFFIX",
    damage: "damage",
    windup: "windup",
    inflict: "inflicted",
  },
} as const satisfies Record<CommandLanguage, Record<string, string>>;

// Commands and content names are gameplay data and may not have translations.
// Keep the source string as a stable fallback while localizing all HUD-owned copy.

export function formatAvailableCommands(commands: readonly string[]): string {
  return commands.join(", ");
}

/** Ring registry를 기준으로 표시용 접두사/기본 명령어/접미사를 분리한다. */
export function splitRingCommand(command: string): CommandHudSegments {
  let baseCommand = command;
  let prefix: string | undefined;
  let suffix: string | undefined;
  const prefixes = RING_CONFIGS.filter((ring) => ring.position === "prefix").sort(
    (left, right) => right.commandAffix.length - left.commandAffix.length,
  );
  const suffixes = RING_CONFIGS.filter((ring) => ring.position === "suffix").sort(
    (left, right) => right.commandAffix.length - left.commandAffix.length,
  );

  for (const ring of prefixes) {
    const token = `${ring.commandAffix} `;
    if (baseCommand.startsWith(token)) {
      prefix = ring.commandAffix;
      baseCommand = baseCommand.slice(token.length);
      break;
    }
  }
  for (const ring of suffixes) {
    const token = ` ${ring.commandAffix}`;
    if (baseCommand.endsWith(token)) {
      suffix = ring.commandAffix;
      baseCommand = baseCommand.slice(0, -token.length);
      break;
    }
  }

  return {
    ...(prefix === undefined ? {} : { prefix }),
    baseCommand,
    ...(suffix === undefined ? {} : { suffix }),
  };
}

export function formatSegmentedCommand(command: string, language: CommandLanguage = "ko"): string {
  const segments = splitRingCommand(command);
  const copy = HUD_COPY[language];
  return [
    segments.prefix === undefined ? null : `${copy.prefix}: ${segments.prefix}`,
    `${copy.command}: ${segments.baseCommand}`,
    segments.suffix === undefined ? null : `${copy.suffix}: ${segments.suffix}`,
  ]
    .filter((part): part is string => part !== null)
    .join("  |  ");
}

export function formatSegmentedAvailableCommands(
  commands: readonly string[],
  language: CommandLanguage = "ko",
): string {
  return commands.map((command) => formatSegmentedCommand(command, language)).join("\n");
}

export function formatAvailableSkillPreviews(
  skills: readonly SkillPreviewInput[],
  resolveApCost: (skill: SkillPreviewInput) => number = (skill) => skill.apCost,
  resolveDamage: (skill: SkillPreviewInput) => number | null = () => null,
  language: CommandLanguage = "ko",
): string {
  const copy = HUD_COPY[language];
  const sortedSkills = [...skills]
    .filter((skill) => {
      if (skill.command === undefined) return true;
      const segments = splitRingCommand(skill.command);
      return segments.prefix === undefined && segments.suffix === undefined;
    })
    .sort((left, right) => {
      const leftRank = left.category === "special" ? 1 : 0;
      const rightRank = right.category === "special" ? 1 : 0;
      return leftRank - rightRank;
    });
  const skillRows = sortedSkills.map((skill) => {
    const label = skill.category === "special" ? copy.specialSkill : copy.basicSkill;
    const ap = Math.max(0, Math.round(resolveApCost(skill)));
    const damage = resolveDamage(skill);
    return `${label} : ${skill.name} : ${ap} : ${damage === null ? "-" : Math.max(0, Math.round(damage))}`;
  });
  const ringRows = skills.flatMap((skill) => {
    if (skill.command === undefined) return [];
    const segments = splitRingCommand(skill.command);
    if (
      (segments.prefix === undefined && segments.suffix === undefined) ||
      (segments.prefix !== undefined && segments.suffix !== undefined)
    ) {
      return [];
    }
    const affix = segments.prefix ?? segments.suffix;
    const ring = RING_CONFIGS.find((candidate) => candidate.commandAffix === affix);
    if (ring === undefined) return [];
    const modifiers = (ring.modifiers as readonly RingSkillModifier[]).filter(
      (modifier) => modifier.skillCategories === undefined || modifier.skillCategories.includes(skill.category),
    );
    const effects = modifiers.flatMap((modifier) => [
      ...(modifier.damageMultiplier === undefined
        ? []
        : [
            `${modifier.damageMultiplier >= 1 ? "+" : ""}${Math.round((modifier.damageMultiplier - 1) * 100)}% ${copy.damage}`,
          ]),
      ...(modifier.apCostDelta === undefined
        ? []
        : [`${modifier.apCostDelta >= 0 ? "+" : ""}${modifier.apCostDelta} AP`]),
      ...(modifier.windupMultiplier === undefined
        ? []
        : [`${copy.windup} ${Math.round((modifier.windupMultiplier - 1) * 100)}%`]),
      ...(modifier.onHitStatus === undefined ? [] : [`${modifier.onHitStatus.statusId} ${copy.inflict}`]),
    ]);
    if (effects.length === 0) return [];
    const displayName = [segments.prefix, skill.name, segments.suffix]
      .filter((part): part is string => part !== undefined)
      .join(" ");
    return [`${segments.prefix === undefined ? copy.suffix : copy.prefix} : ${displayName} : ${effects.join(", ")}`];
  });
  return [copy.header, ...skillRows, ...ringRows].join("\n");
}

export function createSkillCommandEffects(
  skill: SkillLike | undefined,
  language: CommandLanguage = "ko",
): CommandHudEffect[] {
  if (skill === undefined) return [];
  return (skill.effects ?? []).flatMap((effect, index) => {
    if (effect.type === "damage") return [];
    if (effect.type === "guard") {
      const reduction = Math.round((1 - effect.damageMultiplier) * 100);
      return [
        {
          id: `${skill.id}:guard:${index}`,
          name: language === "ko" ? "피해 감소" : "Damage reduction",
          description:
            language === "ko"
              ? `${skill.name}: 받는 피해 ${reduction}% 감소 · ${effect.durationMs / 1_000}초`
              : `${skill.name}: ${reduction}% less damage taken · ${effect.durationMs / 1_000}s`,
          durationMs: effect.durationMs,
          remainingMs: null,
          textureKey: effectTextureKey("guard"),
        },
      ];
    }
    if (effect.type === "shield") {
      return [
        {
          id: `${skill.id}:shield:${index}`,
          name: language === "ko" ? "실드" : "Shield",
          description:
            language === "ko"
              ? `${skill.name}: 실드 ${effect.amount} · ${effect.durationMs / 1_000}초`
              : `${skill.name}: ${effect.amount} shield · ${effect.durationMs / 1_000}s`,
          durationMs: effect.durationMs,
          remainingMs: null,
          textureKey: effectTextureKey("shield"),
        },
      ];
    }
    return [
      {
        id: `${skill.id}:status:${effect.statusId}:${index}`,
        name: effect.statusId,
        description:
          language === "ko"
            ? `${skill.name}: ${effect.statusId} ${effect.stacks ?? 1}중첩 · ${effect.durationMs / 1_000}초`
            : `${skill.name}: ${effect.statusId} ×${effect.stacks ?? 1} · ${effect.durationMs / 1_000}s`,
        durationMs: effect.durationMs,
        remainingMs: null,
        textureKey: effectTextureKey(effect.statusId),
      },
    ];
  });
}

export function createTimedApCommandEffects(
  effects: readonly TimedApEffectLike[] = [],
  language: CommandLanguage = "ko",
): CommandHudEffect[] {
  return effects.map((effect, index) => ({
    id: `${effect.id}:${index}`,
    name:
      language === "ko"
        ? effect.amountPerSecond >= 0
          ? "AP 재생 증가"
          : "AP 재생 감소"
        : effect.amountPerSecond >= 0
          ? "AP regeneration up"
          : "AP regeneration down",
    description:
      language === "ko"
        ? `AP 재생 ${effect.amountPerSecond >= 0 ? "+" : ""}${effect.amountPerSecond}/초`
        : `AP regeneration ${effect.amountPerSecond >= 0 ? "+" : ""}${effect.amountPerSecond}/s`,
    durationMs: effect.durationMs,
    remainingMs: effect.remainingMs,
    textureKey: effectTextureKey(effect.amountPerSecond >= 0 ? "ap-regen-up" : "ap-regen-down"),
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
  private readonly tooltipBackground: Phaser.GameObjects.Rectangle;
  private readonly tooltipText: Phaser.GameObjects.Text;
  private readonly effectVisuals: EffectVisual[] = [];
  private readonly scene: Phaser.Scene;
  private readonly skills: readonly SkillPreviewSkill[];
  private readonly resolveApCost: (skill: SkillPreviewInput) => number;
  private readonly resolveDamage: (skill: SkillPreviewInput) => number | null;
  private state: CommandHudState;
  private panelWidth = 420;
  private panelHeight = 152;
  private hoveredEffectId: string | null = null;
  private renderedLanguage: CommandLanguage;

  constructor(scene: Phaser.Scene, initialSnapshot: CommandInputSnapshot, options: CommandHudOptions = {}) {
    this.scene = scene;
    this.skills = options.skills ?? [];
    this.resolveApCost = options.resolveApCost ?? ((skill) => skill.apCost);
    this.resolveDamage = options.resolveDamage ?? (() => null);
    this.state = createCommandHudState(initialSnapshot);
    this.renderedLanguage = this.getLanguage();
    this.container = scene.add.container(0, 0);
    this.panel = scene.add
      .rectangle(0, 0, this.panelWidth, this.panelHeight, 0x0b1220, 0.94)
      .setOrigin(0)
      .setStrokeStyle(2, 0x64748b, 0.95);
    this.title = scene.add.text(18, 10, "TYPE // COMMAND // COST // DAMAGE", {
      color: "#64748b",
      fontFamily: "monospace",
      fontSize: "11px",
      fontStyle: "bold",
    });
    this.commandText = scene.add.text(18, 30, "", {
      color: "#f8fafc",
      fontFamily: "Galmuri9, monospace",
      fontSize: "18px",
      lineSpacing: 2,
    });
    this.inputText = scene.add.text(18, 76, "", {
      color: "#cbd5e1",
      fontFamily: "Galmuri9, monospace",
      fontSize: "16px",
    });
    this.statusText = scene.add.text(18, 104, "", {
      color: "#cbd5e1",
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
    });
    this.progressTrack = scene.add.rectangle(18, 128, 190, 8, 0x1e293b, 1).setOrigin(0, 0.5);
    this.progressFill = scene.add.rectangle(18, 128, 1, 8, 0x14b8a6, 1).setOrigin(0, 0.5);
    this.feedbackText = scene.add.text(226, 104, "", {
      color: "#fcd34d",
      fontFamily: "Galmuri9, monospace",
      fontSize: "13px",
    });
    this.tooltipBackground = scene.add
      .rectangle(0, 0, 220, 64, 0x020617, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, 0x94a3b8, 0.9)
      .setVisible(false);
    this.tooltipText = scene.add
      .text(0, 0, "", {
        color: "#f8fafc",
        fontFamily: "Galmuri9, monospace",
        fontSize: "11px",
        lineSpacing: 4,
        wordWrap: { width: 196, useAdvancedWrap: true },
      })
      .setVisible(false);
    this.container.add([
      this.panel,
      this.title,
      this.commandText,
      this.inputText,
      this.statusText,
      this.progressTrack,
      this.progressFill,
      this.feedbackText,
      this.tooltipBackground,
      this.tooltipText,
    ]);
    this.container.setSize(this.panelWidth, this.panelHeight);
    scene.events.on(SCENE_UPDATE_EVENT, this.refreshRuntimePresentation, this);
    scene.events.once(SCENE_SHUTDOWN_EVENT, this.release, this);
    scene.events.once(SCENE_DESTROY_EVENT, this.release, this);
    this.refresh();
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }
  setSize(width: number, height: number): void {
    this.panelWidth = Math.max(260, width);
    this.panelHeight = Math.max(132, height, this.getRequiredHeight());
    this.panel.setSize(this.panelWidth, this.panelHeight);
    this.container.setSize(this.panelWidth, this.panelHeight);
    this.refresh();
  }
  getHeight(): number {
    return this.panelHeight;
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
      commands: [...this.state.commands],
      feedback: this.state.feedback ? { ...this.state.feedback } : null,
    };
  }
  getEffects(): readonly CommandHudEffect[] {
    return this.resolveEffects();
  }

  private getLanguage(): CommandLanguage {
    return this.scene.registry.get(MENU_SETTINGS_REGISTRY_KEYS.commandLanguage) === "en" ? "en" : "ko";
  }

  private resolveEffects(): CommandHudEffect[] {
    const language = this.getLanguage();
    const effectScene = this.scene as EffectAwareScene;
    const currentSkill = this.skills.find((skill) => skill.command === this.state.command);
    // Status icons in the command panel describe a possible result, not an
    // active status. Active bleed/weaken/etc. effects are rendered by the
    // actor HUD, so they must not appear beside damage previews while idle.
    const skillEffects = createSkillCommandEffects(currentSkill, language).filter(
      (effect) => !effect.id.includes(":status:"),
    );
    const timedApEffects = createTimedApCommandEffects(effectScene.actionPoints?.snapshot.timedEffects, language);
    return [...skillEffects, ...timedApEffects];
  }

  private refreshRuntimePresentation(): void {
    const language = this.getLanguage();
    if (language !== this.renderedLanguage) {
      this.renderedLanguage = language;
      this.refresh();
      return;
    }
    this.refreshEffects();
  }

  private refreshEffects(): void {
    const effects = this.resolveEffects();
    for (let index = 0; index < effects.length; index += 1) {
      const effect = effects[index];
      if (effect === undefined) continue;
      const visual = this.getOrCreateEffectVisual(index);
      const x = EFFECT_LEFT + index * (EFFECT_SIZE + EFFECT_GAP);
      const darknessHeight = EFFECT_SIZE * getEffectDarknessRatio(effect);
      visual.container.setPosition(x, EFFECT_TOP).setVisible(true).setActive(true);
      const textureKey = this.scene.textures.exists(effect.textureKey) ? effect.textureKey : MISSING_ASSET_TEXTURE_KEY;
      if (visual.icon.texture.key !== textureKey) visual.icon.setTexture(textureKey);
      visual.darkness.setPosition(0, EFFECT_SIZE - darknessHeight).setSize(EFFECT_SIZE, darknessHeight);
      visual.hitArea.setData("effectId", effect.id);
      visual.hitArea.setData("effect", effect);
    }
    for (let index = effects.length; index < this.effectVisuals.length; index += 1) {
      this.effectVisuals[index]?.container.setVisible(false).setActive(false);
    }

    const hovered = effects.find((effect) => effect.id === this.hoveredEffectId);
    if (hovered === undefined) {
      this.hideTooltip();
      return;
    }
    this.showTooltip(
      hovered,
      effects.findIndex((effect) => effect.id === hovered.id),
    );
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
    const icon = this.scene.add
      .image(EFFECT_SIZE / 2, EFFECT_SIZE / 2, MISSING_ASSET_TEXTURE_KEY)
      .setDisplaySize(EFFECT_SIZE - 8, EFFECT_SIZE - 8);

    const maskShape = this.scene.make.graphics({ x: 0, y: 0 });
    maskShape.setVisible(false);
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRoundedRect(0, 0, EFFECT_SIZE, EFFECT_SIZE, EFFECT_RADIUS);
    const darknessMask = maskShape.createGeometryMask();
    const darkness = this.scene.add
      .rectangle(0, EFFECT_SIZE, EFFECT_SIZE, 0, 0x000000, 0.68)
      .setOrigin(0)
      .setMask(darknessMask);
    const hitArea = this.scene.add
      .zone(0, 0, EFFECT_SIZE, EFFECT_SIZE)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hitArea.on(POINTER_OVER_EVENT, () => {
      const effect = hitArea.getData("effect") as CommandHudEffect | undefined;
      if (effect === undefined) return;
      this.hoveredEffectId = effect.id;
      this.showTooltip(effect, index);
    });
    hitArea.on("pointerout", () => {
      this.hoveredEffectId = null;
      this.hideTooltip();
    });

    effectContainer.add([frame, icon, darkness, hitArea]);
    this.container.add(effectContainer);
    this.container.bringToTop(this.tooltipBackground);
    this.container.bringToTop(this.tooltipText);
    const visual = { container: effectContainer, frame, icon, darkness, darknessMask, hitArea };
    this.effectVisuals.push(visual);
    return visual;
  }

  private showTooltip(effect: CommandHudEffect, index: number): void {
    const tooltipWidth = 220;
    const x = clamp(
      EFFECT_LEFT + index * (EFFECT_SIZE + EFFECT_GAP),
      8,
      Math.max(8, this.panelWidth - tooltipWidth - 8),
    );
    const remainingTime =
      this.getLanguage() === "ko"
        ? formatEffectRemainingTime(effect.remainingMs)
        : effect.remainingMs === null
          ? "Duration: applied on activation"
          : effect.remainingMs >= 1_000
            ? `Time remaining: ${(effect.remainingMs / 1_000).toFixed(1)}s`
            : `Time remaining: ${Math.ceil(Math.max(0, effect.remainingMs))}ms`;
    const label = `${effect.name}\n${effect.description}\n${remainingTime}`;
    this.tooltipText
      .setText(label)
      .setPosition(x + 12, EFFECT_TOP + EFFECT_SIZE + 13)
      .setVisible(true);
    const tooltipHeight = Math.max(64, this.tooltipText.height + 20);
    this.tooltipBackground
      .setPosition(x, EFFECT_TOP + EFFECT_SIZE + 7)
      .setSize(tooltipWidth, tooltipHeight)
      .setVisible(true);
    this.container.bringToTop(this.tooltipBackground);
    this.container.bringToTop(this.tooltipText);
  }

  private hideTooltip(): void {
    this.tooltipBackground.setVisible(false);
    this.tooltipText.setVisible(false);
  }

  private release(): void {
    this.scene.events.off(SCENE_UPDATE_EVENT, this.refreshRuntimePresentation, this);
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
    const contentLeft =
      effectCount > 0
        ? Math.min(18 + effectCount * (EFFECT_SIZE + EFFECT_GAP), Math.max(18, this.panelWidth - 180))
        : 18;

    this.panel.setStrokeStyle(2, presentation.accent, 0.95);
    this.title.setX(contentLeft);
    const inputY = Math.max(58, this.panelHeight - 42);
    const listHeight = Math.max(24, inputY - 34);
    const previewLines = formatAvailableSkillPreviews(
      this.skills,
      this.resolveApCost,
      this.resolveDamage,
      language,
    ).split("\n");
    const previewHeader = previewLines.shift() ?? HUD_COPY[language].header;
    const previewText = previewLines.join("\n");
    this.title.setText(previewHeader);
    const previewLineCount = Math.max(1, previewLines.length);
    const previewFontSize = Math.max(10, Math.min(commandFontSize, Math.floor(listHeight / previewLineCount)));
    this.commandText
      .setPosition(contentLeft, 30)
      .setFontSize(previewFontSize)
      .setLineSpacing(0)
      .setWordWrapWidth(Math.max(120, this.panelWidth - contentLeft - 18), true)
      .setText(previewText)
      .setColor("#f8fafc")
      .setCrop(0, 0, Math.max(120, this.panelWidth - contentLeft - 18), listHeight);

    const inputPrefix = language === "ko" ? "입력" : "INPUT";
    this.inputText
      .setPosition(18, inputY)
      .setText(this.state.input.length > 0 ? `${inputPrefix}: ${this.state.input}` : `${inputPrefix}: —`)
      .setColor(presentation.color);

    this.statusText.setVisible(false);

    const progressY = this.panelHeight - 12;
    this.progressTrack.setPosition(18, progressY).setSize(progressWidth, 8);
    this.progressFill
      .setPosition(18, progressY)
      .setSize(progressWidth * progressRatio, 8)
      .setFillStyle(presentation.accent, 1);
    this.feedbackText.setVisible(false).setText("");
    this.refreshEffects();
  }

  private getRequiredHeight(): number {
    const rowHeight = this.panelWidth < 380 ? 18 : this.panelWidth < 620 ? 20 : 24;
    return 70 + Math.max(1, this.skills.length + 1) * rowHeight;
  }
}
