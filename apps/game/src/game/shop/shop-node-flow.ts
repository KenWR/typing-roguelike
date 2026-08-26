import {
  applyShopPurchase,
  completeMapNode,
  createShopOffers,
  exitShop,
  type RunState,
  type ShopOffer,
} from "@typing-roguelike/shared";

export type ShopNodeFlowState = Readonly<{
  runState: RunState;
  nodeId: string;
  nextNodeIds: readonly string[];
  offers: readonly ShopOffer[];
  purchasedOfferIds: ReadonlySet<string>;
  completed: boolean;
}>;

export const createShopNodeFlow = (
  runState: RunState,
  nodeId: string,
  nextNodeIds: readonly string[],
  offers: readonly ShopOffer[] = createShopOffers(),
): ShopNodeFlowState => ({
  runState,
  nodeId,
  nextNodeIds: [...nextNodeIds],
  offers: [...offers],
  purchasedOfferIds: new Set<string>(),
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
