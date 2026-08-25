import Phaser from "phaser";
import { TEXTURE_KEYS } from "../assets/asset-catalog";
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
  private hudReservation!: Phaser.GameObjects.Rectangle;
  private hudLabel!: Phaser.GameObjects.Text;

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

    this.hudReservation = this.add
      .rectangle(0, 0, 1, 1, 0x111827, 0.28)
      .setOrigin(0)
      .setStrokeStyle(1, 0x64748b, 0.55);
    this.hudLabel = this.add.text(0, 0, "HUD 예약 영역 · FE-01 이후 사용", {
      color: "#94a3b8",
      fontFamily: "Galmuri9, monospace",
      fontSize: "14px",
    });
    this.uiLayer.add([this.hudReservation, this.hudLabel]);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseResizeListener, this);
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

    this.hudReservation
      .setPosition(layout.hudReservation.x, layout.hudReservation.y)
      .setSize(layout.hudReservation.width, layout.hudReservation.height);
    this.hudLabel.setPosition(
      layout.hudReservation.x + 12,
      layout.hudReservation.y + 10,
    );
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
