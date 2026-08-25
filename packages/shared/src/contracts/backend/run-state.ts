export type RunState = {
	schemaVersion: number;
	character: Record<string, unknown>;
	inventory: Record<string, unknown>;
	loadout: Record<string, unknown>;
	build: Record<string, unknown>;
	map: {
		mapId: string;
		currentNodeId: string;
		visitedNodeIds: string[];
		nodeStatuses: Record<string, string>;
	};
	runCurrency: number;
};