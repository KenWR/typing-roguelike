import { describe, expect, test } from "bun:test";
import {
  EQUIPMENT_CONFIGS,
  createInitialRunState,
  type MapNodeStatus,
} from "@typing-roguelike/shared";
import { createMapHudView } from "../src/game/run/map-hud-view";
import { initializeRunMap } from "../src/game/run/run-start-map";

describe("createMapHudView", () => {
  test("builds the initial run HUD and current node cards", () => {
    const runState = initializeRunMap(createInitialRunState({ seed: 42 }));
    const view = createMapHudView(runState);

    expect(view.floor).toBe(1);
    expect(view.hpText).toBe("100 / 100");
    expect(view.currencyText).toBe("0");
    expect(view.equipmentText).toBe("장비 없음");
    expect(view.currentLocation).toBe("start");
    expect(view.pathText).toBe("start");
    expect(view.nodes).toHaveLength(3);
    expect(view.nodes.every((node) => node.status === "available")).toBe(true);
  });

  test("preserves all four node statuses for visual rendering", () => {
    const runState = initializeRunMap(createInitialRunState({ seed: 7 }));
    const ids = Object.keys(runState.map.nodeStatuses);
    const statuses: MapNodeStatus[] = ["locked", "available", "in_progress"];
    const nodeStatuses = Object.fromEntries(
      ids.map((id, index) => [id, statuses[index] ?? "cleared"]),
    );

    const view = createMapHudView({
      ...runState,
      map: { ...runState.map, nodeStatuses },
    });

    expect(view.nodes.map((node) => node.status)).toEqual([
      "locked",
      "available",
      "in_progress",
    ]);
  });

  test("shows localized equipment names in weapon, subweapon, ring1, ring2 order", () => {
    const runState = initializeRunMap(createInitialRunState({ seed: 9 }));
    const [weapon, subweapon, ring1, ring2] = EQUIPMENT_CONFIGS.slice(0, 4);

    if (!weapon || !subweapon || !ring1 || !ring2) {
      throw new Error("테스트에 필요한 장비 설정이 부족합니다.");
    }

    const view = createMapHudView({
      ...runState,
      loadout: {
        ...runState.loadout,
        weaponId: weapon.id,
        subweaponId: subweapon.id,
        ring1Id: ring1.id,
        ring2Id: ring2.id,
      },
    });

    expect(view.equipmentText).toBe(
      [weapon.name, subweapon.name, ring1.name, ring2.name].join(" · "),
    );
  });

  test("shows 장비 없음 when every equipment slot is empty", () => {
    const runState = initializeRunMap(createInitialRunState({ seed: 10 }));
    const view = createMapHudView({
      ...runState,
      loadout: {
        ...runState.loadout,
        weaponId: null,
        subweaponId: null,
        ring1Id: null,
        ring2Id: null,
      },
    });

    expect(view.equipmentText).toBe("장비 없음");
  });

  test("uses a safe Korean fallback for unknown equipment ids", () => {
    const runState = initializeRunMap(createInitialRunState({ seed: 11 }));
    const knownEquipment = EQUIPMENT_CONFIGS[0];

    if (!knownEquipment) {
      throw new Error("테스트에 필요한 장비 설정이 없습니다.");
    }

    const view = createMapHudView({
      ...runState,
      loadout: {
        ...runState.loadout,
        weaponId: "equipment_unknown_for_test",
        subweaponId: knownEquipment.id,
      },
    });

    expect(view.equipmentText).toBe(`알 수 없는 장비 · ${knownEquipment.name}`);
  });

  test("shows equipped items and the traversed path", () => {
    const runState = initializeRunMap(createInitialRunState({ seed: 9 }));
    const equipment = EQUIPMENT_CONFIGS[0];

    if (!equipment) {
      throw new Error("테스트에 필요한 장비 설정이 없습니다.");
    }

    const view = createMapHudView({
      ...runState,
      loadout: { ...runState.loadout, weaponId: equipment.id },
      map: {
        ...runState.map,
        currentNodeId: "1-1",
        currentRound: 2,
        choicePath: [1],
      },
    });

    expect(view.equipmentText).toBe(equipment.name);
    expect(view.currentLocation).toBe("1-1");
    expect(view.pathText).toBe("start → 1-1");
  });
});
