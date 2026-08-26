export type InventoryModalKeyAction = "toggle" | "close" | "ignore";

export type InventoryModalLayout = Readonly<{
  compact: boolean;
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
  padding: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  scrollbarX: number;
}>;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export const resolveInventoryModalKey = (
  key: string,
  isOpen: boolean,
): InventoryModalKeyAction => {
  if (key.toLowerCase() === "i") return "toggle";
  if (key.toLowerCase() === "escape" && isOpen) return "close";
  return "ignore";
};

export const clampInventoryModalScroll = (
  offset: number,
  maxScroll: number,
): number => {
  const safeMaxScroll = Math.max(0, maxScroll);
  if (safeMaxScroll === 0) return 0;
  return clamp(offset, -safeMaxScroll, 0);
};

export const createInventoryModalLayout = (
  width: number,
  height: number,
): InventoryModalLayout => {
  const safeInset = clamp(Math.min(width, height) * 0.04, 12, 28);
  const panelWidth = Math.max(1, Math.min(1120, width - safeInset * 2));
  const panelHeight = Math.max(1, Math.min(680, height - safeInset * 2));
  const panelX = (width - panelWidth) / 2;
  const panelY = (height - panelHeight) / 2;
  const compact = panelWidth < 760;
  const padding = compact ? 12 : 18;
  const headerHeight = compact ? 54 : 62;
  const footerHeight = compact ? 32 : 38;
  const scrollbarWidth = 12;

  return {
    compact,
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    padding,
    contentX: panelX + padding,
    contentY: panelY + headerHeight,
    contentWidth: Math.max(
      1,
      panelWidth - padding * 2 - scrollbarWidth,
    ),
    contentHeight: Math.max(
      1,
      panelHeight - headerHeight - footerHeight,
    ),
    scrollbarX: panelX + panelWidth - padding - 4,
  };
};
