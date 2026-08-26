import {
  RING_BY_ID,
  getEquipmentDataModel,
  type EquipmentConfig,
  type RunState,
} from "@typing-roguelike/shared";

export const getRunEquipmentForExchange = (
  runState: Readonly<RunState>,
): readonly EquipmentConfig[] =>
  runState.inventory.itemInstances.flatMap((itemId) => {
    const equipment = getEquipmentDataModel(itemId);
    if (equipment !== undefined) return [equipment];
    if (RING_BY_ID.has(itemId)) return [];
    throw new Error(`Unknown equipment in run settlement: ${itemId}`);
  });

export const calculateRunEquipmentExchangeValue = (
  runState: Readonly<RunState>,
): number => {
  const equipmentValue = getRunEquipmentForExchange(runState).reduce(
    (sum, equipment) => sum + equipment.sellValue,
    0,
  );
  const ringValue = runState.inventory.itemInstances.reduce((sum, itemId) => {
    const ring = RING_BY_ID.get(itemId);
    return sum + (ring?.sellValue ?? 0);
  }, 0);
  const value = equipmentValue + ringValue;
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Run equipment exchange value must be a safe integer.");
  }
  return value;
};
