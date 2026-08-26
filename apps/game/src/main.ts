import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { CombatFoundationScene } from "./game/scenes/CombatFoundationScene";
import { StartScene } from "./game/scenes/CoreFlowScenes";
import { EquipmentScene } from "./game/scenes/EquipmentScene";
import { RunRewardSelectionScene } from "./game/scenes/RunRewardSelectionScene";
import { CompletableRunResultScene } from "./game/scenes/CompletableRunResultScene";
import { ShopNodeScene } from "./game/scenes/ShopNodeScene";
import { RestNodeScene } from "./game/scenes/RestNodeScene";
import { InteractiveMapScene } from "./game/scenes/InteractiveMapScene";
import { SettingsScene } from "./game/scenes/PersistentSettingsScene";
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
  scene: [
    BootScene,
    StartScene,
    SettingsScene,
    InteractiveMapScene,
    CombatFoundationScene,
    RunRewardSelectionScene,
    EquipmentScene,
    ShopNodeScene,
    RestNodeScene,
    CompletableRunResultScene,
  ],
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
