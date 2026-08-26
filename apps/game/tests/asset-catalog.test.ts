import { describe, expect, test } from "bun:test";
import { RELIC_CONFIGS } from "@typing-roguelike/shared";
import {
  ASSET_PATHS,
  RUNTIME_IMAGE_ASSETS,
  getRelicIconTextureKey,
} from "../src/game/assets/asset-catalog";

describe("relic icon asset catalog", () => {
  test("maps every configured relic to an existing 96px runtime icon", async () => {
    expect(RUNTIME_IMAGE_ASSETS).toHaveLength(RELIC_CONFIGS.length);
    expect(new Set(RUNTIME_IMAGE_ASSETS.map((asset) => asset.key)).size).toBe(
      RELIC_CONFIGS.length,
    );

    for (const relic of RELIC_CONFIGS) {
      const relativePath = `${ASSET_PATHS.relicIcons.hud}/${relic.id}.png`;
      expect(RUNTIME_IMAGE_ASSETS).toContainEqual({
        key: getRelicIconTextureKey(relic.id),
        path: relativePath,
      });

      const bytes = new Uint8Array(
        await Bun.file(`apps/game/public${relativePath}`).arrayBuffer(),
      );
      const pngHeader = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      expect(pngHeader.getUint32(16)).toBe(96);
      expect(pngHeader.getUint32(20)).toBe(96);
    }
  });
});
