import Phaser from "phaser";
import {
  defineSkill,
  type GeneratedMapNode,
  type RunState,
} from "@typing-roguelike/shared";
import { TEXTURE_KEYS } from "../assets/asset-catalog";
import { EnemyCombatRuntime } from "../combat/enemy-combat-runtime";
import { EnemyAttackTimeline } from "../combat/enemy-attack-timeline";
import { ActionPointResource } from "../combat/action-point-resource";
import { CombatState } from "../combat/combat-state";
import {
  CombatPauseController,
  type PauseDocument,
  type PauseWindow,
} from "../combat/combat-pause-controller";
import type { CombatEncounterInitialization } from "../combat/encounter-initializer";
import { createEnemyHealthView } from "../combat/enemy-health-view";
import { PlayerCombatRuntime } from "../combat/player-combat-runtime";
import { SkillCommandStarter } from "../combat/skill-command-starter";
import {
  CombatFeedbackController,
  playProceduralCombatSound,
} from "../feedback/combat-feedback";
import { CombatHud } from "../hud/combat-hud";
import { CommandHud } from "../hud/command-hud";
import { EnemyAttackGauge } from "../hud/enemy-attack-gauge";
import { CommandInputBuffer } from "../input/command-input-buffer";
import { createCombatLayout } from "../layout/combat-layout";
import { MENU_SETTINGS_REGISTRY_KEYS } from "./menu-settings";
import { SCENE_KEYS, resolveSceneTransition } from "./scene-contract";

const BACKGROUND_WIDTH = 1600;
const BACKGROUND_HEIGHT = 900;
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
  private enemyPlaceholder!: Phaser.GameObjects.Container;
  private enemyHealthText!: Phaser.GameObjects.Text;
  private combatHud!: CombatHud;
  private enemyAttackGauge!: EnemyAttackGauge;
  private enemyAttackTimeline!: EnemyAttackTimeline;
  private actionPoints!: ActionPointResource;
  private combat!: CombatState;
  private playerCombatRuntime?: PlayerCombatRuntime;
  private enemyCombatRuntime?: EnemyCombatRuntime;
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
    this.enemyCombatRuntime = undefined;
    this.feedback = undefined;
    this.transitionStarted = false;
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

    this.playerPlaceholder = this.createActorPlaceholder("플레이어", 0x3f7f84);
    const enemyLabel = initialization.enemies.length === 0
      ? "적"
      : initialization.enemies.map((enemy) => enemy.name).join(" / ");
    this.enemyPlaceholder = this.createActorPlaceholder(enemyLabel, 0x8d4b52);
    this.worldLayer.add([this.playerPlaceholder, this.enemyPlaceholder]);

    const encounterLabel = this.add
      .text(
        24,
        18,
        `${initialization.encounterId} · ${initialization.rewardPolicy.toUpperCase()}`,
        {
          color: "#9eb0c4",
          fontFamily: "Galmuri9, monospace",
          fontSize: "14px",
        },
      )
      .setOrigin(0, 0);
    this.uiLayer.add(encounterLabel);

    const targetEnemy = initialization.enemies[0];
    const enemyHealthView = createEnemyHealthView(
      targetEnemy?.name,
      targetEnemy?.hp,
      targetEnemy?.hp,
    );
    this.enemyHealthText = this.add
      .text(0, 0, enemyHealthView.label, {
        color: "#f4d7da",
        fontFamily: "Galmuri9, monospace",
        fontSize: "18px",
        backgroundColor: "#301b22",
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5);
    this.uiLayer.add(this.enemyHealthText);

    this.actionPoints = new ActionPointResource();
    this.combat = new CombatState();
    this.combatHud = new CombatHud(this, {
      hp: initialization.player.currentHp,
      maxHp: initialization.player.maxHp,
      ap: this.actionPoints.snapshot.currentAp,
      maxAp: this.actionPoints.snapshot.maxAp,
    });
    this.uiLayer.add(this.combatHud.container);

    this.enemyAttackTimeline = new EnemyAttackTimeline();
    if (this.runState !== undefined) {
      this.enemyCombatRuntime = new EnemyCombatRuntime({
        combat: this.combat,
        enemyTimeline: this.enemyAttackTimeline,
        runState: this.runState as RunState,
        initialization,
      });
      this.enemyCombatRuntime.start();
    } else {
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
    this.commandInputBuffer = new CommandInputBuffer(initialSkill.command);
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
        runState: this.runState,
        initialization,
        nextNodeIds: this.nextNodeIds,
        ...(this.bossNode === undefined ? {} : { bossNode: this.bossNode }),
      });
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
    });
    this.commandCompletionCleanup = skillStarter.connect(
      this.commandInputBuffer,
      (result) => {
        this.combatHud.update({ ap: result.ap.currentAp });
        if (result.started) {
          this.playerCombatRuntime?.registerAction(result.actionId, result.skill);
          if (result.skill.kind === "defense") {
            this.feedback?.trigger("guard");
          }
          this.commandHud.showSkillStarted();
        }
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

    const playerUpdate = this.playerCombatRuntime?.advance(safeDelta);
    if (playerUpdate !== undefined) {
      this.updateEnemyHealth(playerUpdate.enemyHp);
      this.enemyCombatRuntime?.setEnemyHp(playerUpdate.enemyHp);
    }

    if (playerUpdate?.route !== null && playerUpdate?.route !== undefined) {
      this.feedback?.trigger("victory");
      this.startCombatRoute(playerUpdate.route.sceneKey, playerUpdate.route.payload);
      return;
    }

    if (this.enemyCombatRuntime !== undefined) {
      const playerHpBefore = this.enemyCombatRuntime.playerHp;
      const enemyUpdate = this.enemyCombatRuntime.advance(safeDelta);
      this.enemyAttackGauge.update(enemyUpdate.timeline);
      this.combatHud.update({ hp: enemyUpdate.playerHp });
      this.playerCombatRuntime?.setRunState(enemyUpdate.runState);

      if (enemyUpdate.playerHp < playerHpBefore) {
        this.feedback?.trigger("player-hit");
      }
      if (enemyUpdate.route !== null) {
        this.feedback?.trigger("defeat");
        this.startCombatRoute(enemyUpdate.route.sceneKey, enemyUpdate.route.payload);
      }
      return;
    }

    const enemyUpdate = this.enemyAttackTimeline.advance(safeDelta);
    this.enemyAttackGauge.update(enemyUpdate.snapshot);
  }

  private updateEnemyHealth(currentHp: number): void {
    const targetEnemy = this.combatInitialization?.enemies[0];
    const view = createEnemyHealthView(
      targetEnemy?.name,
      currentHp,
      targetEnemy?.hp,
    );
    this.enemyHealthText.setText(view.label);
  }

  private startCombatRoute(sceneKey: string, payload: Readonly<Record<string, unknown>>): void {
    this.transitionStarted = true;
    const transition = resolveSceneTransition(sceneKey, payload);
    this.scene.start(transition.key, transition.payload);
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
      width / BACKGROUND_WIDTH,
      height / BACKGROUND_HEIGHT,
    );
    this.background
      .setPosition(width / 2, height / 2)
      .setScale(backgroundScale);
    this.overlay.setSize(width, height);

    this.playerPlaceholder
      .setPosition(layout.player.x, layout.player.y)
      .setScale(layout.actorScale);
    this.enemyPlaceholder
      .setPosition(layout.enemy.x, layout.enemy.y)
      .setScale(layout.actorScale);
    this.enemyHealthText.setPosition(
      layout.enemy.x,
      layout.enemy.y - 125 * layout.actorScale,
    );

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
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const silhouette = this.add
      .rectangle(0, 0, 120, 180, 0x111827, 0.82)
      .setStrokeStyle(3, accentColor, 1);
    const name = this.add
      .text(0, 0, label, {
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
