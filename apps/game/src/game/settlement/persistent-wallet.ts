import type { RunState } from "@typing-roguelike/shared";

const STORAGE_KEY = "typing-roguelike.persistent-wallet";

export type PersistentWalletSnapshot = Readonly<{
  totalCurrency: number;
  settledRunIds: readonly string[];
}>;

const emptyWallet = (): PersistentWalletSnapshot => ({ totalCurrency: 0, settledRunIds: [] });

export const createSettlementRunId = (runState: Readonly<RunState>): string =>
  `${runState.map.mapId}:${runState.map.seed}`;

export const loadPersistentWallet = (
  storage?: Pick<Storage, "getItem">,
): PersistentWalletSnapshot => {
  if (!storage) return emptyWallet();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyWallet();
    const parsed = JSON.parse(raw) as Partial<PersistentWalletSnapshot>;
    if (
      Number.isSafeInteger(parsed.totalCurrency) &&
      (parsed.totalCurrency ?? -1) >= 0 &&
      Array.isArray(parsed.settledRunIds) &&
      parsed.settledRunIds.every((id) => typeof id === "string")
    ) {
      return {
        totalCurrency: parsed.totalCurrency!,
        settledRunIds: [...parsed.settledRunIds],
      };
    }
  } catch {}
  return emptyWallet();
};

export const applySettlementCurrency = (
  wallet: PersistentWalletSnapshot,
  runState: Readonly<RunState>,
  payout: number,
): Readonly<{ applied: boolean; wallet: PersistentWalletSnapshot }> => {
  if (!Number.isSafeInteger(payout) || payout < 0) {
    throw new RangeError("Settlement payout must be a non-negative safe integer.");
  }
  const runId = createSettlementRunId(runState);
  if (wallet.settledRunIds.includes(runId)) return { applied: false, wallet };
  return {
    applied: true,
    wallet: {
      totalCurrency: wallet.totalCurrency + payout,
      settledRunIds: [...wallet.settledRunIds, runId],
    },
  };
};

export const savePersistentWallet = (
  wallet: PersistentWalletSnapshot,
  storage?: Pick<Storage, "setItem">,
): boolean => {
  if (!storage) return true;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(wallet));
    return true;
  } catch {
    return false;
  }
};
