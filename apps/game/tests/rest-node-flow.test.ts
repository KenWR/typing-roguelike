import { describe, expect, test } from "bun:test";
import { RUN_STATE_SCHEMA_VERSION, type RunState } from "@typing-roguelike/shared";
import { applyRestNodeRecovery, completeRestNode, createRestNodeFlow } from "../src/game/rest/rest-node-flow";

const run = (): RunState => ({
  schemaVersion: RUN_STATE_SCHEMA_VERSION,
  status: "active",
  character: { currentHp: 40, maxHp: 100 },
  inventory: { itemInstances: [], relicInstances: [] },
  loadout: { weaponId: null, subweaponId: null, ring1Id: null, ring2Id: null },
  build: { equippedRelicIds: [] },
  map: {
    mapId: "map",
    seed: 1,
    currentNodeId: "rest",
    currentRound: 1,
    choicePath: [],
    nodeStatuses: { rest: "in_progress", next: "locked" },
  },
  acquiredItemValue: 0,
  runCurrency: 0,
});

describe("rest node flow", () => {
  test("recovery updates hp once", () => {
    const first = applyRestNodeRecovery(createRestNodeFlow(run(), "rest", ["next"]), 25);
    const second = applyRestNodeRecovery(first, 25);
    expect(first.runState.character.currentHp).toBe(65);
    expect(second.runState.character.currentHp).toBe(65);
  });

  test("completing rest clears node and unlocks next", () => {
    const next = completeRestNode(createRestNodeFlow(run(), "rest", ["next"]));
    expect(next.runState.map.nodeStatuses.rest).toBe("cleared");
    expect(next.runState.map.nodeStatuses.next).toBe("available");
  });
});
