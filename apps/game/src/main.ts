import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { CombatFoundationScene } from "./game/scenes/CombatFoundationScene";
import "./styles/global.css";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#111827",
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    parent: "game-root",
  },
  scene: [BootScene, CombatFoundationScene],
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
