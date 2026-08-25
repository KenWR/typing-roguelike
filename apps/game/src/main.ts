import Phaser from "phaser";
import "./styles/global.css";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#111827",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
  },
  scene: [],
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
