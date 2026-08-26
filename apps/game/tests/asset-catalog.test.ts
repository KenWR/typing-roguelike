import { describe, expect, test } from "bun:test";
import { RELIC_CONFIGS } from "@typing-roguelike/shared";
import {
  ASSET_PATHS,
  COMBAT_IMAGE_ASSETS,
  RELIC_ICON_ASSETS,
  RUNTIME_IMAGE_ASSETS,
  SCENE_BACKGROUND_ASSETS,
  getRelicIconTextureKey,
} from "../src/game/assets/asset-catalog";
import { EQUIPMENT_ICON_ASSETS } from "../src/game/assets/equipment-icon-assets";
import { PLAYER_WEAPON_IMAGE_ASSETS } from "../src/game/assets/player-visual-assets";

describe("relic icon asset catalog", () => {
  test("maps every configured relic to an existing 96px runtime icon", async () => {
    expect(RELIC_ICON_ASSETS).toHaveLength(RELIC_CONFIGS.length);
    expect(new Set(RELIC_ICON_ASSETS.map((asset) => asset.key)).size).toBe(RELIC_CONFIGS.length);

    for (const relic of RELIC_CONFIGS) {
      const relativePath = `${ASSET_PATHS.relicIcons.hud}/${relic.id}.png`;
      expect(RELIC_ICON_ASSETS).toContainEqual({
        key: getRelicIconTextureKey(relic.id),
        path: relativePath,
      });

      const bytes = new Uint8Array(await Bun.file(`${import.meta.dir}/../public${relativePath}`).arrayBuffer());
      const pngHeader = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      expect(pngHeader.getUint32(16)).toBe(96);
      expect(pngHeader.getUint32(20)).toBe(96);
    }
  });

  test("includes every image catalog exactly once in the runtime preload contract", async () => {
    expect(RUNTIME_IMAGE_ASSETS).toHaveLength(
      RELIC_ICON_ASSETS.length +
        EQUIPMENT_ICON_ASSETS.length +
        COMBAT_IMAGE_ASSETS.length +
        SCENE_BACKGROUND_ASSETS.length,
    );

    expect(RUNTIME_IMAGE_ASSETS).toEqual(
      expect.arrayContaining([
        ...RELIC_ICON_ASSETS,
        ...EQUIPMENT_ICON_ASSETS,
        ...COMBAT_IMAGE_ASSETS,
        ...SCENE_BACKGROUND_ASSETS,
      ]),
    );

    expect(new Set(RUNTIME_IMAGE_ASSETS.map((asset) => asset.key)).size).toBe(RUNTIME_IMAGE_ASSETS.length);

    for (const asset of SCENE_BACKGROUND_ASSETS) {
      expect(await Bun.file(`${import.meta.dir}/../public${asset.path}`).exists()).toBe(true);
    }
  });

  test("keeps all eight player weapon mappings in the runtime catalog contract", () => {
    expect(PLAYER_WEAPON_IMAGE_ASSETS).toHaveLength(8);
    expect(RUNTIME_IMAGE_ASSETS).toEqual(expect.arrayContaining([...PLAYER_WEAPON_IMAGE_ASSETS]));
  });
});
