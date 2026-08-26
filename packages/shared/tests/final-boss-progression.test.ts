import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "../src/contracts/backend/run-state.ts";
import { completeFinalBossVictory, unlockFinalBoss } from "../src/rules/final-boss-progression.ts";
import { generateNodeChoices } from "../src/rules/map-generation.ts";
import { beginMapNode } from "../src/rules/map-node-state.ts";

const path = Array.from({ length: 8 }, () => 1);
const restNode = generateNodeChoices(17, 9, path)[0]!;
const bossNode = generateNodeChoices(17, 10, [...path, restNode.choice])[0]!;

describe("final boss progression", () => {
	test("unlocks the shared boss after completing any connected recovery branch", () => {
		const runState = createInitialRunState({ seed: 17 });
		const map = beginMapNode({
			...runState.map,
			currentRound: 9,
			currentNodeId: restNode.key,
			choicePath: path,
			nodeStatuses: {
				[restNode.key]: "available",
				[bossNode.key]: "locked",
			},
		}, restNode.key);
		const result = unlockFinalBoss(map, restNode, bossNode);

		expect(result.applied).toBe(true);
		expect(result.state.nodeStatuses[restNode.key]).toBe("cleared");
		expect(result.state.nodeStatuses[bossNode.key]).toBe("available");
		expect(Object.values(result.state.nodeStatuses).filter((status) => status === "available")).toHaveLength(1);
	});

	test("rejects an unconnected or non-rest path before the boss", () => {
		const runState = createInitialRunState({ seed: 17 });
		const startedMap = {
			...runState.map,
			nodeStatuses: { [restNode.key]: "in_progress" as const },
		};
		const unconnectedRest = { ...restNode, nextNodeKeys: [] };

		expect(() => unlockFinalBoss(startedMap, unconnectedRest, bossNode)).toThrow("not connected");
		expect(() => unlockFinalBoss(startedMap, { ...restNode, type: "combat" }, bossNode)).toThrow("required rest");
	});

	test("clears the active run only after victory over the current final boss", () => {
		const runState = createInitialRunState({ seed: 17 });
		const fightingBoss = {
			...runState,
			map: {
				...runState.map,
				currentRound: 10,
				currentNodeId: bossNode.key,
				nodeStatuses: { [bossNode.key]: "in_progress" as const },
			},
		};
		const result = completeFinalBossVictory(fightingBoss, bossNode);

		expect(result.applied).toBe(true);
		expect(result.state.status).toBe("cleared");
		expect(result.state.map.nodeStatuses[bossNode.key]).toBe("cleared");
		expect(fightingBoss.status).toBe("active");
		const duplicate = completeFinalBossVictory(result.state, bossNode);
		expect(duplicate.applied).toBe(false);
		expect(duplicate.state).toBe(result.state);
	});

	test("rejects non-boss and non-current nodes as clear conditions", () => {
		const runState = createInitialRunState({ seed: 17 });
		expect(() => completeFinalBossVictory(runState, { ...bossNode, type: "combat" })).toThrow("final-round boss");
		expect(() => completeFinalBossVictory(runState, bossNode)).toThrow("current in-progress");
	});
});
