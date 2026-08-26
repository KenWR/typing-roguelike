import { describe, expect, test } from "bun:test";
import { EQUIPMENT_CONFIGS } from "@typing-roguelike/shared";
import { RUNTIME_IMAGE_ASSETS } from "../src/game/assets/asset-catalog";
import {
  EQUIPMENT_ICON_ASSETS,
  EQUIPMENT_IDS_WITHOUT_ICON,
  getEquipmentIconTextureKey,
  resolveEquipmentIconTextureKey,
} from "../src/game/assets/equipment-icon-assets";

/** 실행 위치와 무관하게 정적 에셋을 찾도록 테스트 파일 기준으로 해석한다. */
const publicFile = (publicPath: string) =>
  Bun.file(`${import.meta.dir}/../public${publicPath}`);

const WEAPON_SLOT_EQUIPMENT = EQUIPMENT_CONFIGS.filter(
  (equipment) => equipment.slot === "weapon",
);

describe("equipment icon assets", () => {
  test("covers every weapon slot equipment", () => {
    expect(WEAPON_SLOT_EQUIPMENT.length).toBeGreaterThan(0);

    const uncovered = WEAPON_SLOT_EQUIPMENT.filter(
      (equipment) => resolveEquipmentIconTextureKey(equipment.id) === undefined,
    ).map((equipment) => equipment.id);

    expect(uncovered).toEqual([]);
    expect(EQUIPMENT_ICON_ASSETS).toHaveLength(WEAPON_SLOT_EQUIPMENT.length);
  });

  test("leaves subweapons without an icon so the caller can fall back", () => {
    // 아이콘 세트는 무기 8종만 다룬다. 보조무기는 이모지 표현을 유지한다.
    expect(EQUIPMENT_IDS_WITHOUT_ICON.length).toBeGreaterThan(0);

    for (const equipmentId of EQUIPMENT_IDS_WITHOUT_ICON) {
      const equipment = EQUIPMENT_CONFIGS.find((item) => item.id === equipmentId);
      expect(equipment?.slot).toBe("subweapon");
      expect(resolveEquipmentIconTextureKey(equipmentId)).toBeUndefined();
    }
  });

  test("returns no texture key for an unknown equipment id", () => {
    expect(resolveEquipmentIconTextureKey("equipment_does_not_exist")).toBeUndefined();
  });

  test("namespaces texture keys so they cannot collide with relic icons", () => {
    for (const equipment of WEAPON_SLOT_EQUIPMENT) {
      expect(resolveEquipmentIconTextureKey(equipment.id)).toBe(
        `equipment-icon:${equipment.id}`,
      );
    }
  });

  test("ships a 96px file for every mapped icon", async () => {
    const missing: string[] = [];

    for (const asset of EQUIPMENT_ICON_ASSETS) {
      const file = publicFile(asset.path);
      if (!(await file.exists())) {
        missing.push(asset.path);
        continue;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      expect({ width: header.getUint32(16), height: header.getUint32(20) }).toEqual({
        width: 96,
        height: 96,
      });
    }

    expect(missing).toEqual([]);
  });

  test("maps each equipment to a distinct icon file", () => {
    const paths = EQUIPMENT_ICON_ASSETS.map((asset) => asset.path);
    const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);

    expect(duplicates).toEqual([]);
  });

  test("is preloaded by the boot catalog", () => {
    for (const asset of EQUIPMENT_ICON_ASSETS) {
      expect(RUNTIME_IMAGE_ASSETS).toContainEqual(asset);
    }

    const keys = RUNTIME_IMAGE_ASSETS.map((asset) => asset.key);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(duplicates).toEqual([]);
  });

  test("keeps the texture key helper consistent with the asset list", () => {
    for (const equipment of WEAPON_SLOT_EQUIPMENT) {
      const key = getEquipmentIconTextureKey(equipment.id);
      expect(EQUIPMENT_ICON_ASSETS.some((asset) => asset.key === key)).toBe(true);
    }
  });
});
