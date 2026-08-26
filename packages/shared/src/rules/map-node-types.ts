import type { MapNodeType } from "./map-generation.ts";

export const PLAYABLE_MAP_NODE_TYPES = ["combat", "elite", "shop", "rest"] as const satisfies readonly MapNodeType[];
