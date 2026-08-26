import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import { createMapHudView } from "../src/game/run/map-hud-view";
import { initializeRunMap } from "../src/game/run/run-start-map";
import {
  getMapNodeIconFrame,
  getMapNodeIconTextureFrame,
  MAP_NODE_ICON_ASSET,
} from "../src/game/assets/map-node-assets";
import {
  RUNTIME_SPRITESHEET_ASSETS,
  TEXTURE_KEYS,
} from "../src/game/assets/asset-catalog";

describe("map node icon assets", () => {
  test("uses the stable spritesheet key, path, and five-frame mapping", () => {
    expect(MAP_NODE_ICON_ASSET).toEqual({
      key: "map-node-icons",
      path: "/assets/images/map_nodes/map-node-icons.png",
      frameWidth: 192,
      frameHeight: 192,
    });

    expect(getMapNodeIconFrame("rest")).toBe(0);
    expect(getMapNodeIconFrame("combat")).toBe(1);
    expect(getMapNodeIconFrame("elite")).toBe(2);
    expect(getMapNodeIconFrame("shop")).toBe(3);
    expect(getMapNodeIconFrame("boss")).toBe(4);
    expect(getMapNodeIconFrame("reward")).toBeUndefined();
    expect(getMapNodeIconTextureFrame("boss")).toEqual({
      key: "map-node-icons",
      frame: 4,
    });
    expect(getMapNodeIconTextureFrame("reward")).toBeUndefined();
  });

  test("forwards GeneratedMapNode.iconType through the map HUD view", () => {
    const runState = initializeRunMap(createInitialRunState({ seed: 42 }));
    const view = createMapHudView(runState);

    expect(view.nodes.every((node) => node.iconType === node.type)).toBe(true);
  });

  test("registers the spritesheet in the runtime preload catalog", () => {
    expect(TEXTURE_KEYS.mapNodeIcons).toBe(MAP_NODE_ICON_ASSET.key);
    expect(RUNTIME_SPRITESHEET_ASSETS).toEqual([MAP_NODE_ICON_ASSET]);
  });
});
