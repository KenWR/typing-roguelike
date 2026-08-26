import {
  getEquipmentDataModel,
  type EquipmentConfig,
  type RunState,
} from "@typing-roguelike/shared";

export const getRunEquipmentForExchange = (
  runState: Readonly<RunState>,
): readonly EquipmentConfig[] =>
  runState.inventory.itemInstances.map((equipmentId) => {
    const equipment = getEquipmentDataModel(equipmentId);
    if (equipment === undefined) {
      throw new Error(`Unknown equipment in run settlement: ${equipmentId}`);
    }
    return equipment;
  });

export const calculateRunEquipmentExchangeValue = (
  runState: Readonly<RunState>,
): number => {
  const value = getRunEquipmentForExchange(runState).reduce(
    (sum, equipment) => sum + equipment.sellValue,
    0,
  );
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Run equipment exchange value must be a safe integer.");
  }
  return value;
};
