import { describe, expect, test } from "bun:test";
import { createInitialRunState } from "@typing-roguelike/shared";
import {
  applySettlementCurrency,
  createSettlementRunId,
  loadPersistentWallet,
  savePersistentWallet,
} from "../src/game/settlement/persistent-wallet";

describe("persistent wallet", () => {
  test("pays a run exactly once", () => {
    const run = createInitialRunState({ seed: 101 });
    const first = applySettlementCurrency({ totalCurrency: 10, settledRunIds: [] }, run, 25);
    expect(first.applied).toBe(true);
    expect(first.wallet.totalCurrency).toBe(35);

    const second = applySettlementCurrency(first.wallet, run, 25);
    expect(second.applied).toBe(false);
    expect(second.wallet.totalCurrency).toBe(35);
  });

  test("persists and restores total currency", () => {
    let raw: string | null = null;
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => { raw = value; },
    };
    const run = createInitialRunState({ seed: 202 });
    const result = applySettlementCurrency({ totalCurrency: 0, settledRunIds: [] }, run, 77);
    savePersistentWallet(result.wallet, storage);

    expect(loadPersistentWallet(storage)).toEqual(result.wallet);
    expect(loadPersistentWallet(storage).settledRunIds).toContain(createSettlementRunId(run));
  });

  test("reports an unavailable wallet store without throwing", () => {
    const storage = {
      setItem: () => {
        throw new Error("quota_exceeded");
      },
    };

    expect(savePersistentWallet({
      totalCurrency: 50,
      settledRunIds: ["tower-v1:1"],
    }, storage)).toBe(false);
  });
});
