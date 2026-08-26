import Phaser from "phaser";
import { SCENE_KEYS, type SceneKey } from "./scene-contract";

abstract class EmptyCoreScene extends Phaser.Scene {
  protected constructor(key: SceneKey) {
    super(key);
  }
}

export class StartScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.start);
  }
}

export class SettingsScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.settings);
  }
}

export class LobbyScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.lobby);
  }
}

export class MapScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.map);
  }
}

export class ShopScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.shop);
  }
}

export class RestScene extends EmptyCoreScene {
  constructor() {
    super(SCENE_KEYS.rest);
  }
}
