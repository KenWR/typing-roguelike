import { describe, expect, test } from "bun:test";
import {
  createShopModalInputGuardLayout,
  stopShopModalPointerPropagation,
} from "../src/game/shop/shop-modal-input-guard";

describe("shop modal input guard", () => {
  test("covers the full viewport and consumes pointer propagation", () => {
    expect(createShopModalInputGuardLayout(1280, 720)).toEqual({
      x: 640,
      y: 360,
      width: 1280,
      height: 720,
    });

    let stopped = false;
    stopShopModalPointerPropagation(() => {
      stopped = true;
    });
    expect(stopped).toBe(true);
  });
});
