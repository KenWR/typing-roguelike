import {
  RELIC_BY_ID,
  type RelicConfig,
} from "@typing-roguelike/shared";
import { getRelicIconTextureKey } from "../assets/asset-catalog";

export type RelicHudEntry = Readonly<{
  id: string;
  name: string;
  rarity: RelicConfig["rarity"];
  description: string;
  textureKey: string;
}>;

export const createRelicHudEntries = (
  relicIds: readonly string[],
): readonly RelicHudEntry[] => {
  const uniqueIds = [...new Set(relicIds)];
  return uniqueIds.map((id) => {
    const relic = (RELIC_BY_ID as ReadonlyMap<string, RelicConfig>).get(id);
    return {
      id,
      name: relic?.name ?? id,
      rarity: relic?.rarity ?? "common",
      description: relic?.description ?? "등록되지 않은 유물입니다.",
      textureKey: getRelicIconTextureKey(id),
    };
  });
};
