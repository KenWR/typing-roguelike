import { describe, expect, test } from "bun:test";
import {
	beginMapNode,
	completeMapNode,
	getMapNodeStatus,
	isMapNodeStatus,
	type RunMapState,
} from "../src/index";

const createMap = (): RunMapState => ({
	mapId: "tower-v1",
	seed: 1,
	currentNodeId: "start",
	currentRound: 1,
	choicePath: [],
	nodeStatuses: {
		"1-1": "available",
		"1-2": "available",
		"1-3": "available",
		"2-1-1": "locked",
		"2-1-2": "locked",
		"2-1-3": "locked",
		"2-2-1": "locked",
	},
});

describe("map node state", () => {
	test("accepts legacy in_progress status for persisted-state compatibility", () => {
		expect(isMapNodeStatus("locked")).toBe(true);
		expect(isMapNodeStatus("available")).toBe(true);
		expect(isMapNodeStatus("in_progress")).toBe(true);
		expect(isMapNodeStatus("cleared")).toBe(true);
		expect(isMapNodeStatus("done")).toBe(false);
	});

	test("treats missing nodes as locked", () => {
		expect(getMapNodeStatus(createMap(), "unknown")).toBe("locked");
	});

	test("selecting a node keeps it available and locks sibling choices", () => {
		const next = beginMapNode(createMap(), "1-1");

		expect(next.currentNodeId).toBe("1-1");
		expect(next.nodeStatuses["1-1"]).toBe("available");
		expect(next.nodeStatuses["1-2"]).toBe("locked");
		expect(next.nodeStatuses["1-3"]).toBe("locked");
	});

	test("rejects starting locked nodes", () => {
		expect(() => beginMapNode(createMap(), "2-1-1")).toThrow("not available");
	});

	test("clears an available node and unlocks only connected next nodes", () => {
		const started = beginMapNode(createMap(), "1-1");
		const result = completeMapNode(started, "1-1", ["2-1-1", "2-1-2", "2-1-3"]);

		expect(result.applied).toBe(true);
		expect(result.map.nodeStatuses["1-1"]).toBe("cleared");
		expect(result.map.nodeStatuses["2-1-1"]).toBe("available");
		expect(result.map.nodeStatuses["2-1-2"]).toBe("available");
		expect(result.map.nodeStatuses["2-1-3"]).toBe("available");
		expect(result.map.nodeStatuses["2-2-1"]).toBe("locked");
	});

	test("applies the same completion only once", () => {
		const started = beginMapNode(createMap(), "1-1");
		const first = completeMapNode(started, "1-1", ["2-1-1"]);
		const second = completeMapNode(first.map, "1-1", ["2-2-1"]);

		expect(first.applied).toBe(true);
		expect(second.applied).toBe(false);
		expect(second.map).toBe(first.map);
		expect(second.map.nodeStatuses["2-1-1"]).toBe("available");
		expect(second.map.nodeStatuses["2-2-1"]).toBe("locked");
	});

	test("rejects completion for a locked node", () => {
		expect(() => completeMapNode(createMap(), "2-1-1", [])).toThrow("not available");
	});
});
