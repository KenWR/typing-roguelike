import { describe, expect, test } from "bun:test";
import {
  EFFECT_IMAGE_ASSETS,
  resolveEffectTextureKey,
} from "../src/game/assets/effect-visual-assets";
import { RUNTIME_IMAGE_ASSETS } from "../src/game/assets/asset-catalog";

describe("effect visual assets", () => {
  test("ships and preloads all fourteen added effect icons", async () => {
    expect(EFFECT_IMAGE_ASSETS).toHaveLength(14);
    expect(RUNTIME_IMAGE_ASSETS).toEqual(
      expect.arrayContaining([...EFFECT_IMAGE_ASSETS]),
    );
    for (const asset of EFFECT_IMAGE_ASSETS) {
      expect(
        await Bun.file(`${import.meta.dir}/../public${asset.path}`).exists(),
      ).toBe(true);
    }
  });

  test("resolves runtime status aliases to stable texture keys", () => {
    expect(resolveEffectTextureKey("bleed")).toBe("effect:bleed");
    expect(resolveEffectTextureKey("accuracy_down")).toBe("effect:accuracy-down");
    expect(resolveEffectTextureKey("fracture")).toBe("effect:crack");
    expect(resolveEffectTextureKey("unknown")).toBeUndefined();
  });
});
