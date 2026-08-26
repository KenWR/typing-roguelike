import { describe, expect, test } from "bun:test";
import { createInitialRunState, type MapNodeStatus } from "@typing-roguelike/shared";
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

  test("shows equipped items and the traversed path", () => {
    const runState = initializeRunMap(createInitialRunState({ seed: 9 }));
    const view = createMapHudView({
      ...runState,
      loadout: { ...runState.loadout, weaponId: "iron-sword", ring1Id: "amber-ring" },
      map: {
        ...runState.map,
        currentNodeId: "1-1",
        currentRound: 2,
        choicePath: [1],
      },
    });

    expect(view.equipmentText).toBe("iron-sword · amber-ring");
    expect(view.currentLocation).toBe("1-1");
    expect(view.pathText).toBe("start → 1-1");
  });
});
