import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "../src/contracts/backend/run-state.ts";
import { applyRestRecovery } from "../src/rules/rest-recovery.ts";

describe("rest recovery", () => {
	test("applies a data-configured heal and reports before and after HP", () => {
		const started = createInitialRunState({ seed: 7, maxHp: 100, initialHp: 35 });
		const result = applyRestRecovery({
			resultId: "rest-node-1",
			runState: started,
			config: { healAmount: 24 },
		});

		expect(result).toMatchObject({
			applied: true,
			resultId: "rest-node-1",
			beforeHp: 35,
			afterHp: 59,
			healedAmount: 24,
		});
		expect(result.runState.character.currentHp).toBe(59);
		expect(started.character.currentHp).toBe(35);
	});

	test("caps recovery at maximum HP", () => {
		const started = createInitialRunState({ seed: 7, maxHp: 100, initialHp: 92 });
		const result = applyRestRecovery({
			resultId: "rest-node-2",
			runState: started,
			config: { healAmount: 30 },
		});

		expect(result.afterHp).toBe(100);
		expect(result.healedAmount).toBe(8);
	});

	test("does not apply the same rest result twice", () => {
		const started = createInitialRunState({ seed: 7, maxHp: 100, initialHp: 40 });
		const first = applyRestRecovery({
			resultId: "rest-node-3",
			runState: started,
			config: { healAmount: 20 },
		});
		const duplicate = applyRestRecovery({
			resultId: "rest-node-3",
			runState: first.runState,
			config: { healAmount: 20 },
			appliedResultIds: first.appliedResultIds,
		});

		expect(duplicate).toMatchObject({
			applied: false,
			beforeHp: 60,
			afterHp: 60,
			healedAmount: 0,
		});
		expect(duplicate.runState).toBe(first.runState);
		expect(duplicate.appliedResultIds).toBe(first.appliedResultIds);
	});

	test("rejects invalid configuration and inactive runs", () => {
		const active = createInitialRunState({ seed: 7 });
		expect(() => applyRestRecovery({
			resultId: "rest-node-4",
			runState: active,
			config: { healAmount: -1 },
		})).toThrow(RangeError);
		expect(() => applyRestRecovery({
			resultId: " ",
			runState: active,
			config: { healAmount: 10 },
		})).toThrow(RangeError);
		expect(() => applyRestRecovery({
			resultId: "rest-node-5",
			runState: { ...active, status: "dead" },
			config: { healAmount: 10 },
		})).toThrow(Error);
	});
});
