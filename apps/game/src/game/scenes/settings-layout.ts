export type SettingsLayout = {
  compact: boolean;
  panelX: number;
  panelTop: number;
  panelWidth: number;
  panelHeight: number;
  panelPadding: number;
  rowWidth: number;
  rowHeight: number;
  rowGap: number;
  actionGap: number;
  rowFontSize: string;
  titleFontSize: string;
  descriptionFontSize: string;
  statusFontSize: string;
  helpFontSize: string;
  titleY: number;
  descriptionY: number;
  firstSettingTop: number;
  statusY: number;
  helpY: number;
};

const EXPANDED_COMPACT_MIN_HEIGHT = 541;

export const resolveSettingsLayout = (width: number, height: number): SettingsLayout => {
  const compact = width < 640 || height < 620;
  const microCompact = compact && height <= 320;
  const ultraCompact = compact && height <= 420;
  // The expanded compact metrics need at least 20px between the status and
  // keyboard-help anchors. Below that height, retain the tighter metrics.
  const tightCompact = compact && !ultraCompact && height < EXPANDED_COMPACT_MIN_HEIGHT;
  const horizontalMargin = compact ? (width <= 320 ? 12 : 16) : 0;
  const panelWidth = Math.max(1, Math.min(compact ? width - horizontalMargin * 2 : 660, width - 24));
  const panelHeight = Math.max(1, Math.min(560, height - (microCompact ? 8 : ultraCompact ? 16 : 32)));
  const panelTop = Math.max(microCompact ? 4 : ultraCompact ? 8 : 16, (height - panelHeight) / 2);
  const panelX = width / 2;
  const panelPadding = compact ? (microCompact ? 8 : ultraCompact ? 12 : tightCompact ? 16 : 24) : 44;
  const rowWidth = Math.max(1, Math.min(compact ? 320 : 460, panelWidth - panelPadding * 2));
  const rowHeight = compact ? (microCompact ? 22 : ultraCompact ? 28 : tightCompact ? 34 : 44) : 48;
  const rowGap = compact ? (microCompact ? 1 : ultraCompact ? 2 : tightCompact ? 4 : 8) : 10;
  const actionGap = compact ? (microCompact ? 3 : ultraCompact ? 6 : tightCompact ? 10 : 20) : 24;
  const titleOffset = compact ? (microCompact ? 12 : ultraCompact ? 16 : tightCompact ? 22 : 36) : 44;
  const descriptionOffset = compact ? (microCompact ? 30 : ultraCompact ? 40 : tightCompact ? 54 : 73) : 86;
  const firstSettingOffset = compact ? (microCompact ? 45 : ultraCompact ? 62 : tightCompact ? 78 : 102) : 112;
  const statusGap = compact ? (microCompact ? 8 : ultraCompact ? 18 : tightCompact ? 22 : 32) : 30;
  const footerInset = compact ? (microCompact ? 10 : ultraCompact ? 14 : tightCompact ? 22 : 36) : 30;

  const settingsBottom = panelTop + firstSettingOffset + 4 * rowHeight + 3 * rowGap;
  const actionBottom = settingsBottom + actionGap + 2 * rowHeight + rowGap;

  return {
    compact,
    panelX,
    panelTop,
    panelWidth,
    panelHeight,
    panelPadding,
    rowWidth,
    rowHeight,
    rowGap,
    actionGap,
    rowFontSize: compact ? (microCompact ? "9px" : ultraCompact ? "11px" : tightCompact ? "13px" : "16px") : "20px",
    titleFontSize: compact ? (microCompact ? "16px" : ultraCompact ? "20px" : tightCompact ? "24px" : "32px") : "40px",
    descriptionFontSize: compact
      ? microCompact
        ? "7px"
        : ultraCompact
          ? "9px"
          : tightCompact
            ? "10px"
            : "12px"
      : "14px",
    statusFontSize: compact ? (microCompact ? "7px" : ultraCompact ? "8px" : tightCompact ? "9px" : "12px") : "14px",
    helpFontSize: compact ? (microCompact ? "7px" : ultraCompact ? "8px" : tightCompact ? "9px" : "11px") : "13px",
    titleY: panelTop + titleOffset,
    descriptionY: panelTop + descriptionOffset,
    firstSettingTop: panelTop + firstSettingOffset,
    statusY: actionBottom + statusGap,
    helpY: panelTop + panelHeight - footerInset,
  };
};
