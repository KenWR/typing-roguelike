export type SettlementOutcome = "death" | "clear";

/**
 * Presentation input for a completed run.
 *
 * The amounts are supplied by the future settlement integration. This adapter
 * only labels the supplied values and adds them for display.
 */
export type SettlementPresentationInput = Readonly<{
  outcome: SettlementOutcome;
  itemExchangeCurrency: number;
  clearRewardCurrency: number;
}>;

export type SettlementViewLine = Readonly<{
  label: string;
  amount: number;
}>;

export type SettlementViewState = Readonly<{
  outcome: SettlementOutcome;
  title: string;
  message: string;
  itemExchange: SettlementViewLine;
  clearReward: SettlementViewLine;
  totalCurrency: number;
  currencyLabel: string;
}>;

export const SETTLEMENT_FIXTURES = {
  death: {
    outcome: "death",
    itemExchangeCurrency: 120,
    clearRewardCurrency: 0,
  },
  clear: {
    outcome: "clear",
    itemExchangeCurrency: 240,
    clearRewardCurrency: 600,
  },
} as const satisfies Record<SettlementOutcome, SettlementPresentationInput>;

export function adaptSettlementViewState(
  input: SettlementPresentationInput,
): SettlementViewState {
  if (input.outcome !== "death" && input.outcome !== "clear") {
    throw new RangeError("outcome must be death or clear");
  }
  assertValidCurrencyAmount(input.itemExchangeCurrency, "item exchange currency");
  assertValidCurrencyAmount(input.clearRewardCurrency, "clear reward currency");

  const totalCurrency = input.itemExchangeCurrency + input.clearRewardCurrency;
  if (!Number.isSafeInteger(totalCurrency)) {
    throw new RangeError("total currency must be a safe integer");
  }

  const isClear = input.outcome === "clear";

  return {
    outcome: input.outcome,
    title: isClear ? "클리어" : "사망",
    message: isClear
      ? "이 런의 보상을 획득했습니다."
      : "이번 런은 여기서 끝났습니다.",
    itemExchange: {
      label: "아이템 환전",
      amount: input.itemExchangeCurrency,
    },
    clearReward: {
      label: "클리어 보상",
      amount: input.clearRewardCurrency,
    },
    totalCurrency,
    currencyLabel: "골드",
  };
}

function assertValidCurrencyAmount(amount: number, label: string): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}
