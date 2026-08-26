export type RewardTransitionPointerGuard = Readonly<{
  acceptsPointerDown: () => boolean;
  release: () => void;
}>;

export const createRewardTransitionPointerGuard = (
  blockedInitially = false,
): RewardTransitionPointerGuard => {
  let blocked = blockedInitially;

  return {
    acceptsPointerDown: () => !blocked,
    release: () => {
      blocked = false;
    },
  };
};
