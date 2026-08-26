import {
  EQUIPMENT_CONFIGS,
  applyShopPurchase,
  completeMapNode,
  createShopOffers,
  exitShop,
  type RunState,
  type ShopOffer,
} from "@typing-roguelike/shared";

export const SHOP_REROLL_BASE_COST = 10;
export const SHOP_REROLL_COST_STEP = 10;

export type ShopNodeFlowState = Readonly<{
  runState: RunState;
  nodeId: string;
  nextNodeIds: readonly string[];
  offers: readonly ShopOffer[];
  purchasedOfferIds: ReadonlySet<string>;
  rerollCount: number;
  completed: boolean;
}>;

const createAvailableOffers = (
  runState: Readonly<RunState>,
  random: () => number = Math.random,
): readonly ShopOffer[] => {
  const owned = new Set(runState.inventory.itemInstances);
  return createShopOffers({
    random,
    equipment: EQUIPMENT_CONFIGS.filter((equipment) => !owned.has(equipment.id)),
    excludedRelicIds: runState.inventory.relicInstances,
  });
};

export const getShopRerollCost = (state: Pick<ShopNodeFlowState, "rerollCount">): number =>
  SHOP_REROLL_BASE_COST + state.rerollCount * SHOP_REROLL_COST_STEP;

export const createShopNodeFlow = (
  runState: RunState,
  nodeId: string,
  nextNodeIds: readonly string[],
  offers: readonly ShopOffer[] = createAvailableOffers(runState),
  purchasedOfferIds: readonly string[] = [],
  rerollCount = 0,
): ShopNodeFlowState => ({
  runState,
  nodeId,
  nextNodeIds: [...nextNodeIds],
  offers: [...offers],
  purchasedOfferIds: new Set(purchasedOfferIds),
  rerollCount,
  completed: false,
});

export const purchaseShopOffer = (
  state: ShopNodeFlowState,
  offerId: string,
): ShopNodeFlowState => {
  if (state.completed) throw new Error("Shop node is already complete.");

  const result = applyShopPurchase({
    offerId,
    offers: state.offers,
    runState: state.runState,
    purchasedOfferIds: state.purchasedOfferIds,
  });

  return {
    ...state,
    runState: result.runState,
    purchasedOfferIds: result.purchasedOfferIds,
  };
};

export const rerollShopOffers = (
  state: ShopNodeFlowState,
  random: () => number = Math.random,
): ShopNodeFlowState => {
  if (state.completed) throw new Error("Shop node is already complete.");
  const cost = getShopRerollCost(state);
  if (state.runState.runCurrency < cost) return state;

  const runState: RunState = {
    ...state.runState,
    runCurrency: state.runState.runCurrency - cost,
  };
  return {
    ...state,
    runState,
    offers: createAvailableOffers(runState, random),
    rerollCount: state.rerollCount + 1,
  };
};

export const completeShopNode = (state: ShopNodeFlowState): ShopNodeFlowState => {
  if (state.completed) return state;

  const runState = exitShop(state.runState);
  const completedMap = completeMapNode(runState.map, state.nodeId, state.nextNodeIds);
  return {
    ...state,
    runState: { ...runState, map: completedMap.map },
    completed: true,
  };
};
