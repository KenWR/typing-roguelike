import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { CombatFoundationScene } from "./game/scenes/CombatFoundationScene";
import {
  MapScene,
  RestScene,
  SettingsScene,
  ShopScene,
  StartScene,
} from "./game/scenes/CoreFlowScenes";
import { CurrencyLobbyScene } from "./game/scenes/CurrencyLobbyScene";
import { EquipmentScene } from "./game/scenes/EquipmentScene";
import { RewardSelectionScene } from "./game/scenes/RewardSelectionScene";
import { CompletableRunResultScene } from "./game/scenes/CompletableRunResultScene";
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
    CurrencyLobbyScene,
    MapScene,
    CombatFoundationScene,
    RewardSelectionScene,
    EquipmentScene,
    ShopScene,
    RestScene,
    CompletableRunResultScene,
  ],
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
