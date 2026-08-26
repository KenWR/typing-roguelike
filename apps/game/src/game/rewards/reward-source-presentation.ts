export type RewardSource = "combat-victory" | "map-reward";

export type RewardSourcePresentation = Readonly<{
  title: string;
  meta: "VICTORY" | "DISCOVERY";
}>;

export const getRewardSourcePresentation = (
  source: RewardSource,
  defaultTitle: string,
): RewardSourcePresentation =>
  source === "map-reward"
    ? { title: "탐색 보상", meta: "DISCOVERY" }
    : { title: defaultTitle, meta: "VICTORY" };
