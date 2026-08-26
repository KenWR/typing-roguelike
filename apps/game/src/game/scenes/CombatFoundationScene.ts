import Phaser from "phaser";
import { defineSkill, type GeneratedMapNode, type RunState, type SkillDefinition } from "@typing-roguelike/shared";
import { TEXTURE_KEYS } from "../assets/asset-catalog";
import { resolveEnemyTextureKey, resolveEnemyVisualState } from "../assets/enemy-visual-assets";
import { resolvePlayerAttackTextureKey, resolvePlayerTextureKey } from "../assets/player-visual-assets";
import { EnemyAttackTimeline } from "../combat/enemy-attack-timeline";
import { ActionPointResource } from "../combat/action-point-resource";
import { playComboBreakSound } from "../audio/runtime-audio";
import { CombatApEffectController } from "../combat/combat-ap-effects";
import { CombatState } from "../combat/combat-state";
import { CombatTargetingController } from "../combat/combat-targeting";
import { CombatPauseController, type PauseDocument, type PauseWindow } from "../combat/combat-pause-controller";
import type { CombatEncounterInitialization, CombatEnemyInitialization } from "../combat/encounter-initializer";
import {
  ENEMY_HEALTH_BAR_PANEL_WIDTH,
  ENEMY_HEALTH_BAR_REGION_BOTTOM,
  ENEMY_HEALTH_BAR_REGION_TOP,
  EnemyHealthBar,
} from "../combat/enemy-health-bar";
import { PlayerCombatRuntime } from "../combat/player-combat-runtime";
import { SkillCommandStarter } from "../combat/skill-command-starter";
import type { ComboSnapshot } from "../combat/combo-tracker";
import { CombatFeedbackController, playProceduralCombatSound } from "../feedback/combat-feedback";
import { CombatHud } from "../hud/combat-hud";
import { CommandHud } from "../hud/command-hud";
import { RelicHud } from "../hud/relic-hud";
import { CommandInputBuffer } from "../input/command-input-buffer";
import { installCommandInputClipboardGuard } from "../input/command-input-clipboard-guard";
import { CommandInputRecoveryController, updateCommandInputElement } from "../input/command-input-recovery";
import { createCombatLayout, ENEMY_HEALTH_BAR_OFFSET_Y } from "../layout/combat-layout";
import { persistCombatRunTransition } from "../run/persist-terminal-run";
import { MENU_SETTINGS_REGISTRY_KEYS } from "./menu-settings";
import { SCENE_KEYS, resolveSceneTransition } from "./scene-contract";

const resolveEnemyMaxShield = (enemy: CombatEnemyInitialization): number =>
  enemy.actions.reduce(
    (maximum, action) => (action.kind === "defense" ? Math.max(maximum, action.shieldAmount ?? 0) : maximum),
    0,
  );

const MAGIC_SHIELD = defineSkill({
  id: "skill.magic-shield",
  name: "매직 실드",
  command: "매직실드",
  kind: "defense",
  category: "guard",
  apCost: 2,
  windupMs: 300,
  recoveryMs: 700,
  effects: [{ type: "shield", amount: 20, durationMs: 1_000 }],
  description: "커맨드를 완성하는 즉시 실드 20을 1초 동안 두른다.",
});

export type CombatFoundationSceneData = Readonly<{
  combat?: CombatEncounterInitialization;
  runState?: Readonly<RunState>;
  node?: GeneratedMapNode;
  nextNodeIds?: readonly string[];
  bossNode?: GeneratedMapNode;
}>;

export class CombatFoundationScene extends Phaser.Scene {
  private backgroundLayer!: Phaser.GameObjects.Container;
  private worldLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Rectangle;
  private playerPlaceholder!: Phaser.GameObjects.Container;
  private playerActorImage?: Phaser.GameObjects.Image;
  private playerRestTextureKey?: string;
  private playerAttackReset?: Phaser.Time.TimerEvent;
  private playerAttackTween?: Phaser.Tweens.Tween;
  private enemyPlaceholders: Phaser.GameObjects.Container[] = [];
  private enemyActorImages = new Map<string, Phaser.GameObjects.Image>();
  private enemyTargetMarkers = new Map<string, Phaser.GameObjects.Rectangle>();
  private enemyHealthBars = new Map<string, EnemyHealthBar>();
  private displayedEnemyHp = new Map<string, number>();
  private displayedEnemyShield: Readonly<Record<string, number>> = {};
  private enemyHitRemainingMs = new Map<string, number>();
  private encounterLabel!: Phaser.GameObjects.Text;
  private combatHud!: CombatHud;
  private relicHud!: RelicHud;
  private enemyAttackTimeline!: EnemyAttackTimeline;
  private actionPoints!: ActionPointResource;
  private apEffects!: CombatApEffectController;
  private combat!: CombatState;
  private playerCombatRuntime?: PlayerCombatRuntime;
  private feedback?: CombatFeedbackController;
  private pauseController?: CombatPauseController;
  private pauseOverlay?: Phaser.GameObjects.Text;
  private commandHud!: CommandHud;
  private comboText!: Phaser.GameObjects.Text;
  private skillStarter?: SkillCommandStarter;
  private commandInputBuffer!: CommandInputBuffer;
  private commandInputRecovery!: CommandInputRecoveryController;
  private targeting?: CombatTargetingController;
  private commandInputCleanup?: () => void;
  private commandCompletionCleanup?: () => void;
  private commandStatusCleanup?: () => void;
  private commandSubmitCleanup?: () => void;
  private combatInitialization?: CombatEncounterInitialization;
  private runState?: Readonly<RunState>;
  private mapNode?: GeneratedMapNode;
  private nextNodeIds: readonly string[] = [];
  private bossNode?: GeneratedMapNode;
  private transitionStarted = false;
  private isComposing = false;

  constructor() {
    super("CombatFoundationScene");
  }

  init(data: CombatFoundationSceneData = {}): void {
    this.combatInitialization = data.combat;
    this.runState = data.runState;
    this.mapNode = data.node;
    this.nextNodeIds = data.nextNodeIds ?? [];
    this.bossNode = data.bossNode;
    this.playerCombatRuntime = undefined;
    this.feedback = undefined;
    this.transitionStarted = false;
    this.enemyPlaceholders = [];
    this.playerActorImage = undefined;
    this.playerRestTextureKey = undefined;
    this.playerAttackReset = undefined;
    this.playerAttackTween = undefined;
    this.enemyActorImages.clear();
    this.enemyTargetMarkers.clear();
    this.enemyHealthBars.clear();
    this.displayedEnemyHp.clear();
    this.displayedEnemyShield = {};
    this.enemyHitRemainingMs.clear();
    this.targeting = undefined;
  }

  create(): void {
    const initialization = this.combatInitialization;
    if (initialization === undefined) {
      const transition = resolveSceneTransition(
        SCENE_KEYS.map,
        this.runState === undefined ? {} : { runState: this.runState },
      );
      this.scene.start(transition.key, transition.payload);
      return;
    }

    this.feedback = new CombatFeedbackController({
      playSound: (key) =>
        playProceduralCombatSound(key, {
          muted: this.sound.mute,
          volume: this.sound.volume,
        }),
      shakeCamera: () => this.cameras.main.shake(110, 0.006),
      isScreenShakeEnabled: () => this.registry.get(MENU_SETTINGS_REGISTRY_KEYS.screenShakeEnabled) !== false,
    });

    this.backgroundLayer = this.add.container(0, 0).setDepth(0);
    this.worldLayer = this.add.container(0, 0).setDepth(100);
    this.uiLayer = this.add.container(0, 0).setDepth(200);

    this.background = this.add.image(0, 0, TEXTURE_KEYS.combatBackground).setOrigin(0.5);
    this.overlay = this.add.rectangle(0, 0, 1, 1, 0x08101b, 0.3).setOrigin(0);
    this.backgroundLayer.add([this.background, this.overlay]);

    const primaryWeaponId = initialization.player.equipmentIds[0];
    this.playerRestTextureKey = resolvePlayerTextureKey(primaryWeaponId);
    this.playerPlaceholder = this.createActorPlaceholder("플레이어", 0x3f7f84, this.playerRestTextureKey);
    const playerActor = this.playerPlaceholder.getAt(0);
    if (playerActor instanceof Phaser.GameObjects.Image) {
      this.playerActorImage = playerActor;
    }
    this.enemyPlaceholders = initialization.enemies.map((enemy) => {
      const placeholder = this.createActorPlaceholder(enemy.name, 0x8d4b52, resolveEnemyTextureKey(enemy.enemyId));
      const actor = placeholder.getAt(0);
      if (actor instanceof Phaser.GameObjects.Image) {
        this.enemyActorImages.set(enemy.instanceId, actor);
      }
      const healthBar = new EnemyHealthBar(this, enemy.hp, enemy.hp, {
        maxShield: resolveEnemyMaxShield(enemy),
      });
      // Keep the telegraph panel directly above the HP bar in the combat
      // layout, with enough separation to read both at a glance.
      healthBar.container.setPosition(0, ENEMY_HEALTH_BAR_OFFSET_Y);
      placeholder.add(healthBar.container);
      this.enemyHealthBars.set(enemy.instanceId, healthBar);
      const marker = this.add
        .rectangle(
          0,
          ENEMY_HEALTH_BAR_OFFSET_Y + (ENEMY_HEALTH_BAR_REGION_TOP + ENEMY_HEALTH_BAR_REGION_BOTTOM) / 2,
          ENEMY_HEALTH_BAR_PANEL_WIDTH + 10,
          ENEMY_HEALTH_BAR_REGION_BOTTOM - ENEMY_HEALTH_BAR_REGION_TOP + 10,
          0x000000,
          0,
        )
        .setStrokeStyle(3, 0xffd166, 0.95)
        .setVisible(false);
      placeholder.add(marker);
      placeholder.sendToBack(marker);
      this.enemyTargetMarkers.set(enemy.instanceId, marker);
      this.displayedEnemyHp.set(enemy.instanceId, enemy.hp);
      this.enemyHitRemainingMs.set(enemy.instanceId, 0);
      return placeholder;
    });
    this.worldLayer.add([this.playerPlaceholder, ...this.enemyPlaceholders]);

    this.encounterLabel = this.add
      .text(0, 0, `${initialization.encounterId} · ${initialization.rewardPolicy.toUpperCase()}`, {
        color: "#9eb0c4",
        fontFamily: "Galmuri9, monospace",
        fontSize: "14px",
      })
      .setOrigin(1, 0);
    this.uiLayer.add(this.encounterLabel);

    this.actionPoints = new ActionPointResource();
    this.apEffects = new CombatApEffectController({
      actionPoints: this.actionPoints,
      relicIds: this.runState?.build.equippedRelicIds ?? [],
    });
    this.combat = new CombatState();
    this.targeting = new CombatTargetingController({
      enemyIds: initialization.enemies.map((enemy) => enemy.instanceId),
      isAlive: (enemyId) => (this.displayedEnemyHp.get(enemyId) ?? 0) > 0,
      onTargetChanged: () => this.refreshTargetPresentation(),
    });
    this.combatHud = new CombatHud(this, {
      hp: initialization.player.currentHp,
      maxHp: initialization.player.maxHp,
      ap: this.actionPoints.snapshot.currentAp,
      maxAp: this.actionPoints.snapshot.maxAp,
      shield: 0,
    });
    this.relicHud = new RelicHud(this, this.runState?.inventory.relicInstances ?? []);
    this.relicHud.container.setDepth(900);
    this.uiLayer.add(this.combatHud.container);

    this.enemyAttackTimeline = new EnemyAttackTimeline();
    if (this.runState === undefined) {
      for (const enemy of initialization.enemies.slice(0, 2)) {
        const action = enemy.actions[0];
        if (action === undefined) continue;
        this.enemyAttackTimeline.startAttack({
          timelineId: `${enemy.instanceId}:${action.id}`,
          enemyId: enemy.instanceId,
          targetId: "player",
          attackId: action.id,
          attackName: action.name,
          attackType: action.kind === "defense" ? "defense" : "attack",
          windupMs: action.windupMs,
          recoveryMs: action.recoveryMs,
        });
      }
    }
    const availableSkills =
      initialization.player.skills.length > 0
        ? initialization.player.skills.map((skill) => defineSkill(skill))
        : [MAGIC_SHIELD];
    const initialSkill = availableSkills[0] ?? MAGIC_SHIELD;
    this.commandInputBuffer = new CommandInputBuffer(availableSkills.map((skill) => skill.command));
    this.commandInputRecovery = new CommandInputRecoveryController(this.commandInputBuffer);
    this.commandHud = new CommandHud(this, this.commandInputBuffer.snapshot);
    this.uiLayer.add(this.commandHud.container);
    this.comboText = this.add
      .text(0, 0, "x0 +0%", {
        color: "#fcd34d",
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        fontStyle: "bold",
        stroke: "#101827",
        strokeThickness: 4,
      })
      .setOrigin(1, 1);
    this.uiLayer.add(this.comboText);

    if (this.runState !== undefined) {
      this.playerCombatRuntime = new PlayerCombatRuntime({
        combat: this.combat,
        enemyTimeline: this.enemyAttackTimeline,
        actionPoints: this.actionPoints,
        apEffects: this.apEffects,
        runState: this.runState,
        initialization,
        nextNodeIds: this.nextNodeIds,
        ...(this.bossNode === undefined ? {} : { bossNode: this.bossNode }),
      });
      this.playerCombatRuntime.start();
      // The runtime grants an enemy defense shield while starting its first
      // windup. Sync the HUD immediately so the initial defense state is
      // visible before the first Phaser update tick.
      this.displayedEnemyShield = this.playerCombatRuntime.enemyShield;
      this.updateEnemyHealth(this.playerCombatRuntime.enemyHp, this.enemyAttackTimeline.snapshot);
      this.refreshTargetPresentation();
    }

    const skillStarter = new SkillCommandStarter({
      skills: availableSkills,
      actionPoints: this.actionPoints,
      combat: this.combat,
      actorId: "player",
      targetId: initialSkill.kind === "defense" ? "player" : (initialization.enemies[0]?.instanceId ?? "player"),
      resolveApCost: (skill) => this.apEffects.resolveSkillCost(skill),
      resolveTargetId: (skill) =>
        skill.kind === "defense"
          ? "player"
          : (this.targeting?.refresh() ?? initialization.enemies[0]?.instanceId ?? "player"),
    });
    this.skillStarter = skillStarter;
    this.commandCompletionCleanup = skillStarter.connect(this.commandInputBuffer, (result) => {
      if (result.started) {
        this.apEffects.onSkillStarted(result.skill, result.combo.count);
        this.playerCombatRuntime?.registerAction(result.actionId, result.skill, result.combo.multiplier);
        this.playPlayerAttackVisual(primaryWeaponId, result.skill);
        if (result.skill.kind === "defense") {
          this.feedback?.trigger("guard");
        }
        this.updateComboDisplay(result.combo);
        this.commandHud.showSkillStarted();
      }
      this.combatHud.update({ ap: this.actionPoints.snapshot.currentAp });
    });
    this.commandStatusCleanup = this.commandInputBuffer.onStatusChanged(({ snapshot }) => {
      if (snapshot.status === "complete") {
        this.feedback?.trigger("command-success");
      }
    });
    this.commandSubmitCleanup = this.commandInputBuffer.onSubmitted(({ snapshot }) => {
      if (snapshot.input.length === 0) return;
      const combo = this.skillStarter?.comboSnapshot;
      if (snapshot.status !== "complete" || combo?.lastBreakReason === "incorrect-input") {
        this.apEffects.onCommandFailed();
        this.feedback?.trigger("command-failure");
        playComboBreakSound();
      }
      this.updateComboDisplay(combo);
    });
    this.createCommandInputElement();
    this.createPauseHandling();
    this.createTargetHandling();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseCommandInputElement, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseCommandInputElement, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releasePauseHandling, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releasePauseHandling, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseTargetHandling, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseTargetHandling, this);
    this.applyLayout(this.scale.gameSize.width, this.scale.gameSize.height);
  }

  update(_time: number, delta: number): void {
    if (this.combatInitialization === undefined || this.transitionStarted) return;

    const safeDelta = Math.max(0, delta);
    const ap = this.actionPoints.advance(safeDelta);
    this.combatHud.update({ ap: ap.currentAp });
    const previousPlayerHp = this.playerCombatRuntime?.playerHp;
    const playerUpdate = this.playerCombatRuntime?.advance(safeDelta);
    if (playerUpdate === undefined) {
      const enemyUpdate = this.enemyAttackTimeline.advance(safeDelta);
      this.updateEnemyVisuals(Object.fromEntries(this.displayedEnemyHp), safeDelta, enemyUpdate.snapshot);
      this.updateEnemyHealth(Object.fromEntries(this.displayedEnemyHp), enemyUpdate.snapshot);
      return;
    }

    this.combatHud.update({
      hp: playerUpdate.playerHp,
      ap: playerUpdate.playerAp,
      shield: playerUpdate.playerShield,
    });
    this.displayedEnemyShield = playerUpdate.enemyShield;
    this.updateEnemyVisuals(playerUpdate.enemyHp, safeDelta, playerUpdate.enemyTimeline.snapshot);
    this.targeting?.refresh();
    this.refreshTargetPresentation();
    this.updateEnemyHealth(playerUpdate.enemyHp, playerUpdate.enemyTimeline.snapshot);

    if (previousPlayerHp !== undefined && playerUpdate.playerHp < previousPlayerHp) {
      this.feedback?.trigger("player-hit");
    }

    if (playerUpdate.route !== null) {
      persistCombatRunTransition(playerUpdate.route, {
        ...(this.mapNode === undefined ? {} : { node: this.mapNode }),
        nextNodeIds: this.nextNodeIds,
      });
      const outcome = this.combat.snapshot.status;
      this.feedback?.trigger(outcome === "victory" ? "victory" : "defeat");
      this.startCombatRoute(playerUpdate.route.sceneKey, playerUpdate.route.payload, outcome === "victory" ? 1_500 : 0);
    }
  }

  private updateEnemyVisuals(
    enemyHp: Readonly<Record<string, number>>,
    deltaMs: number,
    timeline: Readonly<EnemyAttackTimeline["snapshot"]>,
  ): void {
    for (const enemy of this.combatInitialization?.enemies ?? []) {
      const actorImage = this.enemyActorImages.get(enemy.instanceId);
      if (actorImage === undefined) continue;
      const currentHp = enemyHp[enemy.instanceId] ?? enemy.hp;
      const previousHp = this.displayedEnemyHp.get(enemy.instanceId) ?? enemy.hp;
      const previousHitMs = this.enemyHitRemainingMs.get(enemy.instanceId) ?? 0;
      const hitRemainingMs = currentHp < previousHp ? 240 : Math.max(0, previousHitMs - deltaMs);
      this.displayedEnemyHp.set(enemy.instanceId, currentHp);
      this.enemyHitRemainingMs.set(enemy.instanceId, hitRemainingMs);

      const activeAttack = timeline.attacks.find(
        (attack) => attack.enemyId === enemy.instanceId && !attack.impactResolved,
      );
      const state = resolveEnemyVisualState({
        currentHp,
        hitRemainingMs,
        ...(activeAttack === undefined ? {} : { activeAttackId: activeAttack.attackId }),
      });
      const textureKey = resolveEnemyTextureKey(enemy.enemyId, state);
      const readyTextureKey = resolveEnemyTextureKey(enemy.enemyId);
      const nextTextureKey =
        textureKey !== undefined && this.textures.exists(textureKey) ? textureKey : readyTextureKey;
      if (
        nextTextureKey !== undefined &&
        this.textures.exists(nextTextureKey) &&
        actorImage.texture.key !== nextTextureKey
      ) {
        actorImage.setTexture(nextTextureKey);
        actorImage.setScale(Math.min(220 / actorImage.width, 260 / actorImage.height));
      }
    }
  }
  private updateEnemyHealth(
    enemyHp: Readonly<Record<string, number>>,
    timeline: Readonly<EnemyAttackTimeline["snapshot"]> = this.enemyAttackTimeline.snapshot,
  ): void {
    for (const enemy of this.combatInitialization?.enemies ?? []) {
      const activeAttack = timeline.attacks.find(
        (attack) => attack.enemyId === enemy.instanceId && attack.phase !== "resolved",
      );
      const telegraphProgress =
        activeAttack?.phase === "windup" ? activeAttack.phaseProgress : activeAttack === undefined ? 0 : 1;
      const healthBar = this.enemyHealthBars.get(enemy.instanceId);
      healthBar?.update(enemyHp[enemy.instanceId] ?? enemy.hp, enemy.hp, {
        shield: this.displayedEnemyShield[enemy.instanceId] ?? 0,
        maxShield: resolveEnemyMaxShield(enemy),
        ...(this.targeting?.targetId === undefined ? {} : { targeted: this.targeting.targetId === enemy.instanceId }),
      });
      healthBar?.updateTelegraph(activeAttack?.attackName, activeAttack?.attackType ?? null, telegraphProgress);
    }
  }

  private createTargetHandling(): void {
    if (typeof document === "undefined") return;
    this.targeting?.bind(document);
    this.refreshTargetPresentation();
  }

  private releaseTargetHandling(): void {
    this.targeting?.dispose();
  }

  /** 지정한 적에게만 조준 테두리를 보여 주고 나머지는 살짝 흐리게 둡니다. */
  private refreshTargetPresentation(): void {
    const targetId = this.targeting?.targetId;
    for (const [enemyId, marker] of this.enemyTargetMarkers) {
      const alive = (this.displayedEnemyHp.get(enemyId) ?? 0) > 0;
      marker.setVisible(alive && enemyId === targetId);
      this.enemyHealthBars.get(enemyId)?.setTargeted(alive && enemyId === targetId);
      this.enemyActorImages.get(enemyId)?.setAlpha(!alive || enemyId === targetId ? 1 : 0.62);
    }
  }

  private startCombatRoute(sceneKey: string, payload: Readonly<Record<string, unknown>>, delayMs: number): void {
    this.transitionStarted = true;
    this.releaseCommandInputElement();
    const transition = resolveSceneTransition(sceneKey, payload);
    this.time.delayedCall(delayMs, () => {
      this.scene.start(transition.key, transition.payload);
    });
  }

  private createPauseHandling(): void {
    this.pauseOverlay = this.add
      .text(0, 0, "일시정지\nESC로 재개", {
        fontFamily: "Galmuri9, monospace",
        fontSize: "28px",
        color: "#f9fafb",
        backgroundColor: "#111827",
        align: "center",
        padding: { x: 30, y: 20 },
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setVisible(false);

    this.pauseController = new CombatPauseController(
      [this.combat, this.actionPoints, this.enemyAttackTimeline],
      (paused) => {
        this.pauseOverlay?.setVisible(paused);
      },
    );

    if (typeof document !== "undefined" && typeof window !== "undefined") {
      this.pauseController.bind(document as unknown as PauseDocument, window as unknown as PauseWindow);
    }
  }

  private releasePauseHandling(): void {
    this.pauseController?.dispose();
    this.pauseController = undefined;
    this.pauseOverlay?.destroy();
    this.pauseOverlay = undefined;
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.applyLayout(gameSize.width, gameSize.height);
  }

  private applyLayout(width: number, height: number): void {
    const layout = createCombatLayout(width, height);
    this.cameras.main.setViewport(0, 0, width, height);

    const backgroundScale = Math.max(width / this.background.width, height / this.background.height);
    this.background.setPosition(width / 2, height / 2).setScale(backgroundScale);
    this.overlay.setSize(width, height);

    this.playerPlaceholder.setPosition(layout.player.x, layout.player.y).setScale(layout.actorScale);
    const enemyCount = this.enemyPlaceholders.length;
    const enemySpan = Math.min(width * 0.38, 420 * layout.actorScale);
    const enemySpacing = enemyCount > 1 ? enemySpan / (enemyCount - 1) : 0;
    this.enemyPlaceholders.forEach((placeholder, index) => {
      placeholder
        .setPosition(layout.enemy.x + (index - (enemyCount - 1) / 2) * enemySpacing, layout.enemy.y)
        .setScale(layout.actorScale);
    });
    this.relicHud.setPosition(layout.relicHudReservation.x, layout.relicHudReservation.y);
    this.relicHud.setSize(layout.relicHudReservation.width, layout.relicHudReservation.height, width >= 720 ? 260 : 0);
    this.encounterLabel
      .setPosition(layout.relicHudReservation.right - 12, layout.relicHudReservation.y + 15)
      .setVisible(width >= 720);
    this.combatHud.setPosition(layout.hudReservation.x, layout.hudReservation.y);
    this.combatHud.setSize(layout.hudReservation.width, layout.hudReservation.height);
    this.commandHud.setPosition(layout.commandHudReservation.x, layout.commandHudReservation.y);
    this.commandHud.setSize(layout.commandHudReservation.width, layout.commandHudReservation.height);
    this.comboText.setPosition(width - 24, height - 24).setVisible(this.skillStarter !== undefined);
    this.pauseOverlay?.setPosition(width / 2, height / 2);
  }

  private updateComboDisplay(snapshot: ComboSnapshot | undefined): void {
    if (snapshot === undefined) return;
    const bonusPercent = Math.round((snapshot.multiplier - 1) * 100);
    this.comboText.setText(`x${snapshot.count} +${bonusPercent}%`).setColor(snapshot.count > 0 ? "#fcd34d" : "#94a3b8");
  }

  private createCommandInputElement(): void {
    if (typeof document === "undefined") return;

    const input = document.createElement("input");
    input.type = "text";
    input.id = "command-input";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "커맨드 입력");
    Object.assign(input.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    });

    const updateFromElement = (): void => {
      const result = updateCommandInputElement(this.commandInputRecovery, input, {
        isComposing: this.isComposing,
      });
      this.commandHud.update(result.snapshot);
    };
    const handleCompositionStart = (): void => {
      this.isComposing = true;
      updateFromElement();
    };
    const handleCompositionUpdate = (): void => updateFromElement();
    const handleCompositionEnd = (): void => {
      this.isComposing = false;
      updateFromElement();
    };
    const handleInput = (): void => updateFromElement();

    input.addEventListener("compositionstart", handleCompositionStart);
    input.addEventListener("compositionupdate", handleCompositionUpdate);
    input.addEventListener("compositionend", handleCompositionEnd);
    input.addEventListener("input", handleInput);
    const removeClipboardGuard = installCommandInputClipboardGuard(input);
    document.body.appendChild(input);
    input.focus({ preventScroll: true });
    this.commandInputCleanup = () => {
      input.removeEventListener("compositionstart", handleCompositionStart);
      input.removeEventListener("compositionupdate", handleCompositionUpdate);
      input.removeEventListener("compositionend", handleCompositionEnd);
      input.removeEventListener("input", handleInput);
      removeClipboardGuard();
      input.remove();
      this.commandInputCleanup = undefined;
    };
  }

  private releaseCommandInputElement(): void {
    this.commandInputCleanup?.();
    this.commandCompletionCleanup?.();
    this.commandCompletionCleanup = undefined;
    this.commandStatusCleanup?.();
    this.commandStatusCleanup = undefined;
    this.commandSubmitCleanup?.();
    this.commandSubmitCleanup = undefined;
    this.isComposing = false;
  }

  private createActorPlaceholder(
    label: string,
    accentColor: number,
    textureKey?: string,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const silhouette =
      textureKey !== undefined && this.textures.exists(textureKey)
        ? this.add.image(0, 0, textureKey)
        : this.add.rectangle(0, 0, 120, 180, 0x111827, 0.82).setStrokeStyle(3, accentColor, 1);
    if (silhouette instanceof Phaser.GameObjects.Image) {
      const scale = Math.min(220 / silhouette.width, 260 / silhouette.height);
      silhouette.setScale(scale);
    }
    const name = this.add
      .text(0, 128, label, {
        color: "#e5edf5",
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        align: "center",
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5);
    container.add([silhouette, name]);
    return container;
  }

  private playPlayerAttackVisual(primaryWeaponId: string | undefined, skill: SkillDefinition): void {
    if (!skill.effects.some((effect) => effect.type === "damage")) return;
    const actor = this.playerActorImage;
    const attackTextureKey = resolvePlayerAttackTextureKey(primaryWeaponId, skill.category);
    if (actor === undefined || attackTextureKey === undefined || !this.textures.exists(attackTextureKey)) {
      return;
    }

    this.playerAttackTween?.stop();
    this.playerAttackReset?.remove(false);
    actor.setPosition(0, 0).setTexture(attackTextureKey);
    actor.setScale(Math.min(220 / actor.width, 260 / actor.height));
    this.playerAttackTween = this.tweens.add({
      targets: actor,
      x: 18,
      duration: Math.min(160, Math.max(80, skill.windupMs / 2)),
      yoyo: true,
      ease: "Sine.Out",
    });

    this.playerAttackReset = this.time.delayedCall(Math.max(180, skill.windupMs + skill.recoveryMs), () => {
      actor.setPosition(0, 0);
      if (this.playerRestTextureKey !== undefined && this.textures.exists(this.playerRestTextureKey)) {
        actor.setTexture(this.playerRestTextureKey);
        actor.setScale(Math.min(220 / actor.width, 260 / actor.height));
      }
      this.playerAttackReset = undefined;
      this.playerAttackTween = undefined;
    });
  }

  private releaseResizeListener(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }
}
