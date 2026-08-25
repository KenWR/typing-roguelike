import { describe, expect, test } from "bun:test";
import {
	createInitialRunState,
	type RunState,
} from "../src/contracts/backend/run-state";

describe("RunState", () => {
	test("creates an active run with explicit player and map state", () => {
		const state = createInitialRunState({ seed: 1234, maxHp: 120 });

		expect(state).toEqual({
			schemaVersion: 1,
			status: "active",
			character: { currentHp: 120, maxHp: 120 },
			inventory: { itemInstances: [], relicInstances: [] },
			loadout: {
				weaponId: null,
				subweaponId: null,
				ring1Id: null,
				ring2Id: null,
			},
			build: { equippedRelicIds: [] },
			map: {
				mapId: "tower-v1",
				seed: 1234,
				currentNodeId: "start",
				currentRound: 1,
				choicePath: [],
				nodeStatuses: {},
			},
			acquiredItemValue: 0,
			runCurrency: 0,
		});
	});

	test("preserves combat state and acquired value between checkpoints", () => {
		const started = createInitialRunState({ seed: 1234, maxHp: 100 });
		const progressed = {
			...started,
			character: { currentHp: 64, maxHp: 100 },
			inventory: {
				itemInstances: ["sword-1"],
				relicInstances: ["relic-1"],
			},
			map: {
				...started.map,
				currentNodeId: "2-1",
				currentRound: 2,
				choicePath: [1],
				nodeStatuses: { "1-1": "cleared", "2-1": "current" },
			},
			acquiredItemValue: 75,
		} satisfies RunState;

		const restored = JSON.parse(JSON.stringify(progressed)) as RunState;

		expect(restored.character.currentHp).toBe(64);
		expect(restored.inventory.itemInstances).toEqual(["sword-1"]);
		expect(restored.inventory.relicInstances).toEqual(["relic-1"]);
		expect(restored.acquiredItemValue).toBe(75);
	});

	test("expresses every supported run end state without losing settlement value", () => {
		const active = createInitialRunState({ seed: 1234 });
		const statuses: RunState["status"][] = [
			"dead",
			"cleared",
			"abandoned",
		];

		for (const status of statuses) {
			const ended = {
				...active,
				status,
				acquiredItemValue: 150,
			} satisfies RunState;

			expect(ended.status).toBe(status);
			expect(ended.acquiredItemValue).toBe(150);
		}
	});

	test("rejects invalid initial HP and seed values", () => {
		expect(() => createInitialRunState({ seed: Number.NaN })).toThrow(
			RangeError,
		);
		expect(() => createInitialRunState({ seed: 1, maxHp: 0 })).toThrow(
			RangeError,
		);
		expect(() =>
			createInitialRunState({ seed: 1, maxHp: 100, initialHp: -1 }),
		).toThrow(RangeError);
	});
});
