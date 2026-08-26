import Phaser from "phaser";
import {
  defineSkill,
  type GeneratedMapNode,
  type RunState,
} from "@typing-roguelike/shared";
import { TEXTURE_KEYS } from "../assets/asset-catalog";
import {
  resolveEnemyTextureKey,
  resolveEnemyVisualState,
} from "../assets/enemy-visual-assets";
import { resolvePlayerTextureKey } from "../assets/player-visual-assets";
import { EnemyAttackTimeline } from "../combat/enemy-attack-timeline";
import { ActionPointResource } from "../combat/action-point-resource";
import { CombatApEffectController } from "../combat/combat-ap-effects";
import { CombatState } from "../combat/combat-state";
import {
  CombatPauseController,
  type PauseDocument,
  type PauseWindow,
} from "../combat/combat-pause-controller";
import type { CombatEncounterInitialization } from "../combat/encounter-initializer";
import { createEnemyHealthListLabel } from "../combat/enemy-health-view";
import { PlayerCombatRuntime } from "../combat/player-combat-runtime";
import { SkillCommandStarter } from "../combat/skill-command-starter";
import {
  CombatFeedbackController,
  playProceduralCombatSound,
} from "../feedback/combat-feedback";
import { CombatHud } from "../hud/combat-hud";
import { CommandHud } from "../hud/command-hud";
import { EnemyAttackGauge } from "../hud/enemy-attack-gauge";
import { RelicHud } from "../hud/relic-hud";
import { CommandInputBuffer } from "../input/command-input-buffer";
import { createCombatLayout } from "../layout/combat-layout";
import { MENU_SETTINGS_REGISTRY_KEYS } from "./menu-settings";
import { SCENE_KEYS, resolveSceneTransition } from "./scene-contract";

const MAGIC_SHIELD = defineSkill({
  id: "skill.magic-shield",
  name: "매직 실드",
  command: "매직실드",
  kind: "defense",
  category: "guard",
  apCost: 2,
  windupMs: 300,
  recoveryMs: 700,
  effects: [{ type: "guard", damageMultiplier: 0.5, durationMs: 1_000 }],
  description: "마법 보호막을 전개한다.",
});

export type CombatFoundationSceneData = Readonly<{
  combat?: CombatEncounterInitialization;
  runState?: Readonly<RunState>;
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
  private enemyPlaceholders: Phaser.GameObjects.Container[] = [];
  private enemyActorImages = new Map<string, Phaser.GameObjects.Image>();
  private displayedEnemyHp = new Map<string, number>();
  private enemyHitRemainingMs = new Map<string, number>();
  private enemyHealthText!: Phaser.GameObjects.Text;
  private encounterLabel!: Phaser.GameObjects.Text;
  private combatHud!: CombatHud;
  private relicHud!: RelicHud;
  private enemyAttackGauge!: EnemyAttackGauge;
  private enemyAttackTimeline!: EnemyAttackTimeline;
  private actionPoints!: ActionPointResource;
  private apEffects!: CombatApEffectController;
  private combat!: CombatState;
  private playerCombatRuntime?: PlayerCombatRuntime;
  private feedback?: CombatFeedbackController;
  private pauseController?: CombatPauseController;
  private pauseOverlay?: Phaser.GameObjects.Text;
  private commandHud!: CommandHud;
  private commandInputBuffer!: CommandInputBuffer;
  private commandInputCleanup?: () => void;
  private commandCompletionCleanup?: () => void;
  private commandStatusCleanup?: () => void;
  private combatInitialization?: CombatEncounterInitialization;
  private runState?: Readonly<RunState>;
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
    this.nextNodeIds = data.nextNodeIds ?? [];
    this.bossNode = data.bossNode;
    this.playerCombatRuntime = undefined;
    this.feedback = undefined;
    this.transitionStarted = false;
    this.enemyPlaceholders = [];
    this.enemyActorImages.clear();
    this.displayedEnemyHp.clear();
    this.enemyHitRemainingMs.clear();
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
      playSound: (key) => playProceduralCombatSound(key, {
        muted: this.sound.mute,
        volume: this.sound.volume,
      }),
      shakeCamera: () => this.cameras.main.shake(110, 0.006),
      isScreenShakeEnabled: () =>
        this.registry.get(MENU_SETTINGS_REGISTRY_KEYS.screenShakeEnabled) !== false,
    });

    this.backgroundLayer = this.add.container(0, 0).setDepth(0);
    this.worldLayer = this.add.container(0, 0).setDepth(100);
    this.uiLayer = this.add.container(0, 0).setDepth(200);

    this.background = this.add.image(0, 0, TEXTURE_KEYS.combatBackground).setOrigin(0.5);
    this.overlay = this.add.rectangle(0, 0, 1, 1, 0x08101b, 0.3).setOrigin(0);
    this.backgroundLayer.add([this.background, this.overlay]);

    this.playerPlaceholder = this.createActorPlaceholder(
      "플레이어",
      0x3f7f84,
      resolvePlayerTextureKey(initialization.player.equipmentIds[0]),
    );
    this.enemyPlaceholders = initialization.enemies.map((enemy) => {
      const placeholder = this.createActorPlaceholder(
        enemy.name,
        0x8d4b52,
        resolveEnemyTextureKey(enemy.enemyId),
      );
      const actor = placeholder.getAt(0);
      if (actor instanceof Phaser.GameObjects.Image) {
        this.enemyActorImages.set(enemy.instanceId, actor);
      }
      this.displayedEnemyHp.set(enemy.instanceId, enemy.hp);
      this.enemyHitRemainingMs.set(enemy.instanceId, 0);
      return placeholder;
    });
    this.worldLayer.add([this.playerPlaceholder, ...this.enemyPlaceholders]);

    this.encounterLabel = this.add
      .text(
        0,
        0,
        `${initialization.encounterId} · ${initialization.rewardPolicy.toUpperCase()}`,
        {
          color: "#9eb0c4",
          fontFamily: "Galmuri9, monospace",
          fontSize: "14px",
        },
      )
      .setOrigin(1, 0);
    this.uiLayer.add(this.encounterLabel);

    const initialEnemyHp = Object.fromEntries(
      initialization.enemies.map((enemy) => [enemy.instanceId, enemy.hp]),
    );
    this.enemyHealthText = this.add
      .text(
        0,
        0,
        createEnemyHealthListLabel(initialization.enemies, initialEnemyHp),
        {
          color: "#f4d7da",
          fontFamily: "Galmuri9, monospace",
          fontSize: "18px",
          backgroundColor: "#301b22",
          padding: { x: 12, y: 7 },
          align: "left",
        },
      )
      .setOrigin(0.5);
    this.uiLayer.add(this.enemyHealthText);

    this.actionPoints = new ActionPointResource();
    this.apEffects = new CombatApEffectController({
      actionPoints: this.actionPoints,
      relicIds: this.runState?.build.equippedRelicIds ?? [],
    });
    this.combat = new CombatState();
    this.combatHud = new CombatHud(this, {
      hp: initialization.player.currentHp,
      maxHp: initialization.player.maxHp,
      ap: this.actionPoints.snapshot.currentAp,
      maxAp: this.actionPoints.snapshot.maxAp,
    });
    this.relicHud = new RelicHud(
      this,
      this.runState?.inventory.relicInstances ?? [],
    );
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
    this.enemyAttackGauge = new EnemyAttackGauge(
      this,
      this.enemyAttackTimeline.snapshot,
    );
    this.uiLayer.add(this.enemyAttackGauge.container);

    const availableSkills = initialization.player.skills.length > 0
      ? initialization.player.skills.map((skill) => defineSkill(skill))
      : [MAGIC_SHIELD];
    const initialSkill = availableSkills[0]!;
    this.commandInputBuffer = new CommandInputBuffer(
      availableSkills.map((skill) => skill.command),
    );
    this.commandHud = new CommandHud(this, this.commandInputBuffer.snapshot);
    this.uiLayer.add(this.commandHud.container);
    this.commandStatusCleanup = this.commandInputBuffer.onStatusChanged(({ snapshot }) => {
      if (snapshot.status === "complete") {
        this.feedback?.trigger("command-success");
      } else if (snapshot.status === "incorrect") {
        this.feedback?.trigger("command-failure");
      }
    });

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
    }

    const skillStarter = new SkillCommandStarter({
      skills: availableSkills,
      actionPoints: this.actionPoints,
      combat: this.combat,
      actorId: "player",
      targetId:
        initialSkill.kind === "defense"
          ? "player"
          : (initialization.enemies[0]?.instanceId ?? "player"),
      resolveApCost: (skill) => this.apEffects.resolveSkillCost(skill),
    });
    this.commandCompletionCleanup = skillStarter.connect(
      this.commandInputBuffer,
      (result) => {
        if (result.started) {
          this.apEffects.onSkillStarted(result.skill, result.combo.count);
          this.playerCombatRuntime?.registerAction(result.actionId, result.skill);
          if (result.skill.kind === "defense") {
            this.feedback?.trigger("guard");
          }
          this.commandHud.showSkillStarted();
        }
        this.combatHud.update({ ap: this.actionPoints.snapshot.currentAp });
      },
    );
    this.createCommandInputElement();
    this.createPauseHandling();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseCommandInputElement, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseCommandInputElement, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releasePauseHandling, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releasePauseHandling, this);
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
      this.enemyAttackGauge.update(enemyUpdate.snapshot);
      this.updateEnemyVisuals(
        Object.fromEntries(this.displayedEnemyHp),
        safeDelta,
        enemyUpdate.snapshot,
      );
      return;
    }

    this.enemyAttackGauge.update(playerUpdate.enemyTimeline.snapshot);
    this.combatHud.update({ hp: playerUpdate.playerHp, ap: playerUpdate.playerAp });
    this.updateEnemyHealth(playerUpdate.enemyHp);
    this.updateEnemyVisuals(
      playerUpdate.enemyHp,
      safeDelta,
      playerUpdate.enemyTimeline.snapshot,
    );

    if (
      previousPlayerHp !== undefined &&
      playerUpdate.playerHp < previousPlayerHp
    ) {
      this.feedback?.trigger("player-hit");
    }

    if (playerUpdate.route !== null) {
      const outcome = this.combat.snapshot.status;
      this.feedback?.trigger(outcome === "victory" ? "victory" : "defeat");
      this.startCombatRoute(
        playerUpdate.route.sceneKey,
        playerUpdate.route.payload,
        outcome === "victory" ? 1_500 : 0,
      );
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
      const hitRemainingMs = currentHp < previousHp
        ? 240
        : Math.max(0, previousHitMs - deltaMs);
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
      const nextTextureKey = textureKey !== undefined && this.textures.exists(textureKey)
        ? textureKey
        : readyTextureKey;
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
  private updateEnemyHealth(enemyHp: Readonly<Record<string, number>>): void {
    this.enemyHealthText.setText(
      createEnemyHealthListLabel(
        this.combatInitialization?.enemies ?? [],
        enemyHp,
      ),
    );
  }

  private startCombatRoute(
    sceneKey: string,
    payload: Readonly<Record<string, unknown>>,
    delayMs: number,
  ): void {
    this.transitionStarted = true;
    this.releaseCommandInputElement();
    const transition = resolveSceneTransition(sceneKey, payload);
    this.time.delayedCall(delayMs, () => {
      this.scene.start(transition.key, transition.payload);
    });
  }

  private createPauseHandling(): void {
    this.pauseOverlay = this.add.text(0, 0, "일시정지\nESC로 재개", {
      fontFamily: "Galmuri9, monospace",
      fontSize: "28px",
      color: "#f9fafb",
      backgroundColor: "#111827",
      align: "center",
      padding: { x: 30, y: 20 },
    }).setOrigin(0.5).setDepth(1000).setVisible(false);

    this.pauseController = new CombatPauseController(
      [this.combat, this.actionPoints, this.enemyAttackTimeline],
      (paused) => {
        this.pauseOverlay?.setVisible(paused);
      },
    );

    if (typeof document !== "undefined" && typeof window !== "undefined") {
      this.pauseController.bind(
        document as unknown as PauseDocument,
        window as unknown as PauseWindow,
      );
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

    const backgroundScale = Math.max(
      width / this.background.width,
      height / this.background.height,
    );
    this.background
      .setPosition(width / 2, height / 2)
      .setScale(backgroundScale);
    this.overlay.setSize(width, height);

    this.playerPlaceholder
      .setPosition(layout.player.x, layout.player.y)
      .setScale(layout.actorScale);
    const enemyCount = this.enemyPlaceholders.length;
    const enemySpan = Math.min(width * 0.38, 420 * layout.actorScale);
    const enemySpacing = enemyCount > 1 ? enemySpan / (enemyCount - 1) : 0;
    this.enemyPlaceholders.forEach((placeholder, index) => {
      placeholder
        .setPosition(
          layout.enemy.x + (index - (enemyCount - 1) / 2) * enemySpacing,
          layout.enemy.y,
        )
        .setScale(layout.actorScale);
    });
    this.enemyHealthText.setPosition(
      layout.enemy.x,
      layout.enemy.y - 135 * layout.actorScale,
    );

    this.relicHud.setPosition(
      layout.relicHudReservation.x,
      layout.relicHudReservation.y,
    );
    this.relicHud.setSize(
      layout.relicHudReservation.width,
      layout.relicHudReservation.height,
      width >= 720 ? 260 : 0,
    );
    this.encounterLabel
      .setPosition(
        layout.relicHudReservation.right - 12,
        layout.relicHudReservation.y + 15,
      )
      .setVisible(width >= 720);
    this.combatHud.setPosition(layout.hudReservation.x, layout.hudReservation.y);
    this.combatHud.setSize(layout.hudReservation.width, layout.hudReservation.height);
    this.enemyAttackGauge.setPosition(
      layout.enemyAttackGaugeReservation.x,
      layout.enemyAttackGaugeReservation.y,
    );
    this.enemyAttackGauge.setSize(
      layout.enemyAttackGaugeReservation.width,
      layout.enemyAttackGaugeReservation.height,
    );
    this.commandHud.setPosition(
      layout.commandHudReservation.x,
      layout.commandHudReservation.y,
    );
    this.commandHud.setSize(
      layout.commandHudReservation.width,
      layout.commandHudReservation.height,
    );
    this.pauseOverlay?.setPosition(width / 2, height / 2);
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
      this.commandInputBuffer.updateInput(input.value, {
        isComposing: this.isComposing,
      });
      this.commandHud.update(this.commandInputBuffer.snapshot);
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
    document.body.appendChild(input);
    input.focus({ preventScroll: true });
    this.commandInputCleanup = () => {
      input.removeEventListener("compositionstart", handleCompositionStart);
      input.removeEventListener("compositionupdate", handleCompositionUpdate);
      input.removeEventListener("compositionend", handleCompositionEnd);
      input.removeEventListener("input", handleInput);
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
    this.isComposing = false;
  }

  private createActorPlaceholder(
    label: string,
    accentColor: number,
    textureKey?: string,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const silhouette = textureKey !== undefined && this.textures.exists(textureKey)
      ? this.add.image(0, 0, textureKey)
      : this.add
          .rectangle(0, 0, 120, 180, 0x111827, 0.82)
          .setStrokeStyle(3, accentColor, 1);
    if (silhouette instanceof Phaser.GameObjects.Image) {
      const scale = Math.min(220 / silhouette.width, 260 / silhouette.height);
      silhouette.setScale(scale);
    }    const name = this.add
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

  private releaseResizeListener(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }
}
