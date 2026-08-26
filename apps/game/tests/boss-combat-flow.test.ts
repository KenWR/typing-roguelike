import { describe, expect, test } from "bun:test";
import { RUN_STATE_SCHEMA_VERSION, type GeneratedMapNode, type RunState } from "@typing-roguelike/shared";
import { enterBossCombat, finalizeBossCombat } from "../src/game/combat/boss-combat-flow";

const boss: GeneratedMapNode = {
  choice: 1,
  icon: "boss",
  iconType: "boss",
  key: "10-1",
  parentKey: "9-1",
  nextNodeKeys: [],
  round: 10,
  type: "boss",
};

const run = (bossStatus: "locked" | "available" | "in_progress" = "available"): RunState => ({
  schemaVersion: RUN_STATE_SCHEMA_VERSION,
  status: "active",
  character: { currentHp: 75, maxHp: 100 },
  inventory: { itemInstances: [], relicInstances: [] },
  loadout: { weaponId: null, subweaponId: null, ring1Id: null, ring2Id: null },
  build: { equippedRelicIds: [] },
  map: {
    mapId: "tower-v1",
    seed: 1,
    currentNodeId: bossStatus === "in_progress" ? boss.key : "9-1",
    currentRound: 10,
    choicePath: [1,1,1,1,1,1,1,1,1],
    nodeStatuses: { [boss.key]: bossStatus, "9-1": "cleared" },
  },
  acquiredItemValue: 0,
  runCurrency: 0,
});

describe("boss combat flow", () => {
  test("locked boss cannot be entered", () => {
    const result = enterBossCombat(run("locked"), boss);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("boss-locked");
  });

  test("available boss enters combat with boss reward policy", () => {
    const result = enterBossCombat(run("available"), boss);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.combat.nodeType).toBe("boss");
      expect(result.combat.rewardPolicy).toBe("boss");
      expect(result.runState.map.nodeStatuses[boss.key]).toBe("available");
    }
  });

  test("legacy in-progress boss victory clears run and routes to clear settlement", () => {
    const result = finalizeBossCombat(run("in_progress"), boss, "victory");
    expect(result.runState.status).toBe("cleared");
    expect(result.runState.map.nodeStatuses[boss.key]).toBe("cleared");
    expect(result.payload.result).toBe("clear");
  });

  test("boss defeat routes to death settlement", () => {
    const result = finalizeBossCombat(run("in_progress"), boss, "defeat");
    expect(result.runState.status).toBe("dead");
    expect(result.payload.result).toBe("death");
  });
});
