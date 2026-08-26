import { describe, expect, test } from "bun:test";
import {
  SETTLEMENT_FIXTURES,
  adaptSettlementViewState,
} from "../src/game/settlement/settlement-view-state";

describe("settlement view state adapter", () => {
  test("keeps death status and separates item exchange from clear reward", () => {
    const state = adaptSettlementViewState(SETTLEMENT_FIXTURES.death);

    expect(state).toEqual({
      outcome: "death",
      title: "사망",
      message: "이번 런은 여기서 끝났습니다.",
      itemExchange: { label: "아이템 환전", amount: 120 },
      clearReward: { label: "클리어 보상", amount: 0 },
      totalCurrency: 120,
      currencyLabel: "골드",
    });
  });

  test("keeps clear status and exposes the total paid currency", () => {
    const state = adaptSettlementViewState(SETTLEMENT_FIXTURES.clear);

    expect(state).toMatchObject({
      outcome: "clear",
      title: "클리어",
      itemExchange: { amount: 240 },
      clearReward: { amount: 600 },
      totalCurrency: 840,
      currencyLabel: "골드",
    });
  });

  test("rejects settlement amounts that are not non-negative safe integers", () => {
    expect(() =>
      adaptSettlementViewState({
        outcome: "death",
        itemExchangeCurrency: -1,
        clearRewardCurrency: 0,
      }),
    ).toThrow(RangeError);

    expect(() =>
      adaptSettlementViewState({
        outcome: "clear",
        itemExchangeCurrency: Number.POSITIVE_INFINITY,
        clearRewardCurrency: 1,
      }),
    ).toThrow(RangeError);
  });
});
