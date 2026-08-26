import type { MapNodeStatus, RunMapState } from "../contracts/backend/run-state.ts";
import { MAP_ROUND_COUNT, generateNodeChoices } from "./map-generation.ts";

export const MAP_NODE_STATUSES = [
	"locked",
	"available",
	"in_progress",
	"cleared",
] as const satisfies readonly MapNodeStatus[];

export type CompleteMapNodeResult = Readonly<{
	map: RunMapState;
	applied: boolean;
}>;

export const isMapNodeStatus = (value: unknown): value is MapNodeStatus =>
	typeof value === "string" && MAP_NODE_STATUSES.includes(value as MapNodeStatus);

export const getMapNodeStatus = (
	map: Readonly<RunMapState>,
	nodeId: string,
): MapNodeStatus => map.nodeStatuses[nodeId] ?? "locked";

/**
 * Selecting a node no longer creates a persisted "in progress" state.
 * The selected node remains available until the node flow completes.
 * This makes an interrupted run return to the map instead of resuming mid-node.
 */
export const beginMapNode = (
	map: Readonly<RunMapState>,
	nodeId: string,
): RunMapState => {
	if (getMapNodeStatus(map, nodeId) !== "available") {
		throw new Error(`Map node ${nodeId} is not available.`);
	}

	return {
		...map,
		currentNodeId: nodeId,
	};
};

export const completeMapNode = (
	map: Readonly<RunMapState>,
	nodeId: string,
	nextNodeIds: readonly string[],
): CompleteMapNodeResult => {
	const currentStatus = getMapNodeStatus(map, nodeId);
	if (currentStatus === "cleared") {
		return { map: map as RunMapState, applied: false };
	}
	if (currentStatus !== "available" && currentStatus !== "in_progress") {
		throw new Error(`Map node ${nodeId} is not available.`);
	}

	const currentNode = generateNodeChoices(
		map.seed,
		map.currentRound,
		map.choicePath,
	).find((node) => node.key === nodeId);

	const nodeStatuses: Record<string, MapNodeStatus> = {
		...map.nodeStatuses,
		[nodeId]: "cleared",
	};

	for (const nextNodeId of nextNodeIds) {
		const nextStatus = nodeStatuses[nextNodeId];
		if (nextStatus === undefined || nextStatus === "locked") {
			nodeStatuses[nextNodeId] = "available";
		}
	}

	const advancesRound = currentNode !== undefined && map.currentRound < MAP_ROUND_COUNT;
	return {
		map: {
			...map,
			currentRound: advancesRound ? map.currentRound + 1 : map.currentRound,
			choicePath: advancesRound ? [...map.choicePath, currentNode.choice] : [...map.choicePath],
			nodeStatuses,
		},
		applied: true,
	};
};
