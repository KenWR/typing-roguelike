import Phaser from "phaser";
import { TEXTURE_KEYS } from "../assets/asset-catalog";
import { CombatHud } from "../hud/combat-hud";
import { CommandHud } from "../hud/command-hud";
import { CommandInputBuffer } from "../input/command-input-buffer";
import { createCombatLayout } from "../layout/combat-layout";

const BACKGROUND_WIDTH = 1600;
const BACKGROUND_HEIGHT = 900;

export class CombatFoundationScene extends Phaser.Scene {
  private backgroundLayer!: Phaser.GameObjects.Container;
  private worldLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Rectangle;
  private playerPlaceholder!: Phaser.GameObjects.Container;
  private enemyPlaceholder!: Phaser.GameObjects.Container;
  private combatHud!: CombatHud;
  private commandHud!: CommandHud;
  private commandInputBuffer!: CommandInputBuffer;
  private commandInputCleanup?: () => void;
  private isComposing = false;

  constructor() {
    super("CombatFoundationScene");
  }

  create(): void {
    this.backgroundLayer = this.add.container(0, 0).setDepth(0);
    this.worldLayer = this.add.container(0, 0).setDepth(100);
    this.uiLayer = this.add.container(0, 0).setDepth(200);

    this.background = this.add.image(0, 0, TEXTURE_KEYS.combatBackground).setOrigin(0.5);
    this.overlay = this.add.rectangle(0, 0, 1, 1, 0x08101b, 0.3).setOrigin(0);
    this.backgroundLayer.add([this.background, this.overlay]);

    this.playerPlaceholder = this.createActorPlaceholder("플레이어", 0x3f7f84);
    this.enemyPlaceholder = this.createActorPlaceholder("적", 0x8d4b52);
    this.worldLayer.add([this.playerPlaceholder, this.enemyPlaceholder]);

    this.combatHud = new CombatHud(this, { hp: 80, maxHp: 100, ap: 30, maxAp: 50 });
    this.uiLayer.add(this.combatHud.container);

    this.commandInputBuffer = new CommandInputBuffer("매직실드");
    this.commandHud = new CommandHud(this, this.commandInputBuffer.snapshot);
    this.uiLayer.add(this.commandHud.container);
    this.commandInputBuffer.onCompleted(() => {
      this.commandHud.showSkillStarted();
    });
    this.createCommandInputElement();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseResizeListener, this);
    this.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      this.releaseCommandInputElement,
      this,
    );
    this.events.once(
      Phaser.Scenes.Events.DESTROY,
      this.releaseCommandInputElement,
      this,
    );
    this.applyLayout(this.scale.gameSize.width, this.scale.gameSize.height);
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

    this.combatHud.setPosition(layout.hudReservation.x, layout.hudReservation.y);
    this.combatHud.setSize(layout.hudReservation.width, layout.hudReservation.height);
    this.commandHud.setPosition(
      layout.commandHudReservation.x,
      layout.commandHudReservation.y,
    );
    this.commandHud.setSize(
      layout.commandHudReservation.width,
      layout.commandHudReservation.height,
    );
  }

  private createCommandInputElement(): void {
    if (typeof document === "undefined") {
      return;
    }

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
    const handleCompositionUpdate = (): void => {
      updateFromElement();
    };
    const handleCompositionEnd = (): void => {
      this.isComposing = false;
      updateFromElement();
    };
    const handleInput = (): void => {
      updateFromElement();
    };

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
      })
      .setOrigin(0.5);
    container.add([silhouette, name]);
    return container;
  }

  private releaseResizeListener(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }
}
