import type { MapNodeIconType } from "@typing-roguelike/shared";

export const MAP_NODE_ICON_TEXTURE_KEY = "map-node-icons";

export const MAP_NODE_ICON_ASSET = {
  key: MAP_NODE_ICON_TEXTURE_KEY,
  path: "/assets/images/map_nodes/map-node-icons.png",
  frameWidth: 192,
  frameHeight: 192,
} as const;

export type RenderableMapNodeIconType = Exclude<MapNodeIconType, "reward">;

export const MAP_NODE_ICON_FRAME_BY_TYPE: Readonly<
  Record<RenderableMapNodeIconType, number>
> = {
  rest: 0,
  combat: 1,
  elite: 2,
  shop: 3,
  boss: 4,
};

export const getMapNodeIconFrame = (
  iconType: MapNodeIconType,
): number | undefined =>
  iconType === "reward" ? undefined : MAP_NODE_ICON_FRAME_BY_TYPE[iconType];

export type MapNodeIconTextureFrame = Readonly<{
  key: typeof MAP_NODE_ICON_TEXTURE_KEY;
  frame: number;
}>;

export const getMapNodeIconTextureFrame = (
  iconType: MapNodeIconType,
): MapNodeIconTextureFrame | undefined => {
  const frame = getMapNodeIconFrame(iconType);
  return frame === undefined
    ? undefined
    : { key: MAP_NODE_ICON_TEXTURE_KEY, frame };
};
