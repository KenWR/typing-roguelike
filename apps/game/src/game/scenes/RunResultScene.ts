import Phaser from "phaser";
import {
  adaptSettlementViewState,
  SETTLEMENT_FIXTURES,
  type SettlementPresentationInput,
  type SettlementViewState,
} from "../settlement/settlement-view-state";

const FONT_FAMILY = 'Galmuri9, "Apple SD Gothic Neo", monospace';
const COLORS = {
  backgroundTop: 0x0c1422,
  backgroundBottom: 0x1c2838,
  panel: 0x111b2c,
  panelBorder: 0x40536c,
  row: 0x18263a,
  rowBorder: 0x293b54,
  text: "#edf4fb",
  mutedText: "#a8b8cb",
  gold: "#f5cf72",
  death: 0xd56b78,
  clear: 0x5fd0bd,
} as const;

export class RunResultScene extends Phaser.Scene {
  private viewState!: SettlementViewState;
  private background!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Graphics;
  private statusBadge!: Phaser.GameObjects.Graphics;
  private itemRow!: Phaser.GameObjects.Graphics;
  private clearRow!: Phaser.GameObjects.Graphics;
  private totalPanel!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;
  private itemLabel!: Phaser.GameObjects.Text;
  private itemAmount!: Phaser.GameObjects.Text;
  private clearLabel!: Phaser.GameObjects.Text;
  private clearAmount!: Phaser.GameObjects.Text;
  private totalLabel!: Phaser.GameObjects.Text;
  private totalAmount!: Phaser.GameObjects.Text;

  constructor() {
    super("RunResultScene");
  }

  init(data?: SettlementPresentationInput): void {
    this.viewState = adaptSettlementViewState(
      data ?? SETTLEMENT_FIXTURES.death,
    );
  }

  create(): void {
    this.background = this.add.graphics();
    this.panel = this.add.graphics();
    this.statusBadge = this.add.graphics();
    this.itemRow = this.add.graphics();
    this.clearRow = this.add.graphics();
    this.totalPanel = this.add.graphics();

    this.statusLabel = this.add
      .text(0, 0, "", this.createTextStyle(15, COLORS.text, true))
      .setOrigin(0.5);
    this.title = this.add
      .text(0, 0, "", this.createTextStyle(30, COLORS.text, true))
      .setOrigin(0.5);
    this.message = this.add
      .text(0, 0, "", this.createTextStyle(14, COLORS.mutedText, false))
      .setOrigin(0.5);
    this.itemLabel = this.add
      .text(0, 0, "", this.createTextStyle(16, COLORS.text, false))
      .setOrigin(0, 0.5);
    this.itemAmount = this.add
      .text(0, 0, "", this.createTextStyle(16, COLORS.gold, true))
      .setOrigin(1, 0.5);
    this.clearLabel = this.add
      .text(0, 0, "", this.createTextStyle(16, COLORS.text, false))
      .setOrigin(0, 0.5);
    this.clearAmount = this.add
      .text(0, 0, "", this.createTextStyle(16, COLORS.gold, true))
      .setOrigin(1, 0.5);
    this.totalLabel = this.add
      .text(0, 0, "", this.createTextStyle(16, COLORS.mutedText, false))
      .setOrigin(0, 0.5);
    this.totalAmount = this.add
      .text(0, 0, "", this.createTextStyle(27, COLORS.gold, true))
      .setOrigin(1, 0.5);

    this.statusLabel.setText(this.viewState.title);
    this.title.setText(this.viewState.title);
    this.message.setText(this.viewState.message);
    this.itemLabel.setText(this.viewState.itemExchange.label);
    this.itemAmount.setText(
      this.formatCurrencyAmount(this.viewState.itemExchange.amount),
    );
    this.clearLabel.setText(this.viewState.clearReward.label);
    this.clearAmount.setText(
      this.formatCurrencyAmount(this.viewState.clearReward.amount),
    );
    this.totalLabel.setText("총 지급 재화");
    this.totalAmount.setText(
      `+${this.formatCurrency(this.viewState.totalCurrency)} ${this.viewState.currencyLabel}`,
    );

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseResizeListener, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseResizeListener, this);
    this.applyLayout(this.scale.gameSize.width, this.scale.gameSize.height);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.applyLayout(gameSize.width, gameSize.height);
  }

  private applyLayout(width: number, height: number): void {
    const shortestSide = Math.min(width, height);
    const compact = width < 620;
    const safeInset = Math.max(16, Math.min(48, shortestSide * 0.05));
    const panelWidth = Math.min(760, Math.max(0, width - safeInset * 2));
    const panelHeight = Math.min(Math.max(0, height - safeInset * 2), 560);
    const panelX = (width - panelWidth) / 2;
    const panelY = Math.max(safeInset, (height - panelHeight) / 2);
    const padding = compact ? 20 : 36;
    const contentWidth = Math.max(0, panelWidth - padding * 2);
    const rowHeight = compact ? 72 : 70;
    const rowGap = 12;
    const rowsY = panelY + (compact ? 248 : 250);
    const totalHeight = compact ? 132 : 116;
    const totalY = panelY + panelHeight - padding - totalHeight;
    const accentColor = this.viewState.outcome === "clear" ? COLORS.clear : COLORS.death;
    const amountFontSize = compact ? 15 : 16;

    this.cameras.main.setViewport(0, 0, width, height);
    this.drawBackground(width, height);
    this.drawPanel(this.panel, panelWidth, panelHeight, COLORS.panel, COLORS.panelBorder);
    this.panel.setPosition(panelX, panelY);
    this.drawPanel(this.statusBadge, compact ? 78 : 88, 36, accentColor, accentColor);
    this.statusBadge.setPosition(
      panelX + padding,
      panelY + padding,
    );
    this.drawRow(this.itemRow, contentWidth, rowHeight);
    this.itemRow.setPosition(panelX + padding, rowsY);
    this.drawRow(this.clearRow, contentWidth, rowHeight);
    this.clearRow.setPosition(panelX + padding, rowsY + rowHeight + rowGap);
    this.drawPanel(
      this.totalPanel,
      contentWidth,
      totalHeight,
      0x1c3045,
      accentColor,
    );
    this.totalPanel.setPosition(panelX + padding, totalY);

    this.statusLabel.setPosition(
      panelX + padding + (compact ? 39 : 44),
      panelY + padding + 18,
    );
    this.title
      .setFontSize(compact ? 25 : 30)
      .setPosition(panelX + panelWidth / 2, panelY + (compact ? 112 : 116));
    this.message
      .setFontSize(compact ? 13 : 14)
      .setWordWrapWidth(contentWidth)
      .setPosition(panelX + panelWidth / 2, panelY + (compact ? 157 : 161));

    this.itemLabel
      .setFontSize(amountFontSize)
      .setPosition(panelX + padding + 18, rowsY + rowHeight / 2);
    this.itemAmount
      .setFontSize(amountFontSize)
      .setPosition(panelX + panelWidth - padding - 18, rowsY + rowHeight / 2);
    this.clearLabel
      .setFontSize(amountFontSize)
      .setPosition(
        panelX + padding + 18,
        rowsY + rowHeight + rowGap + rowHeight / 2,
      );
    this.clearAmount
      .setFontSize(amountFontSize)
      .setPosition(
        panelX + panelWidth - padding - 18,
        rowsY + rowHeight + rowGap + rowHeight / 2,
      );
    this.totalLabel
      .setFontSize(compact ? 15 : 16)
      .setPosition(panelX + padding + 20, totalY + totalHeight / 2);
    this.totalAmount
      .setFontSize(compact ? 23 : 27)
      .setPosition(panelX + panelWidth - padding - 20, totalY + totalHeight / 2);
  }

  private drawBackground(width: number, height: number): void {
    this.background.clear();
    this.background.fillGradientStyle(
      COLORS.backgroundTop,
      COLORS.backgroundTop,
      COLORS.backgroundBottom,
      COLORS.backgroundBottom,
      1,
    );
    this.background.fillRect(0, 0, width, height);
    this.background.lineStyle(1, 0x42536a, 0.12);
    for (let offset = -height; offset < width; offset += 96) {
      this.background.lineBetween(offset, 0, offset + height, height);
    }
  }

  private drawPanel(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    fillColor: number,
    borderColor: number,
  ): void {
    graphics.clear();
    graphics.fillStyle(fillColor, 1);
    graphics.fillRoundedRect(0, 0, width, height, 18);
    graphics.lineStyle(2, borderColor, 0.9);
    graphics.strokeRoundedRect(1, 1, Math.max(0, width - 2), Math.max(0, height - 2), 18);
  }

  private drawRow(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
  ): void {
    graphics.clear();
    graphics.fillStyle(COLORS.row, 1);
    graphics.fillRoundedRect(0, 0, width, height, 14);
    graphics.lineStyle(1, COLORS.rowBorder, 1);
    graphics.strokeRoundedRect(1, 1, Math.max(0, width - 2), Math.max(0, height - 2), 14);
  }

  private createTextStyle(
    fontSize: number,
    color: string,
    bold: boolean,
  ): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color,
      fontFamily: FONT_FAMILY,
      fontSize: `${fontSize}px`,
      fontStyle: bold ? "bold" : "normal",
      resolution: 2,
    };
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat("ko-KR").format(amount);
  }

  private formatCurrencyAmount(amount: number): string {
    return `+${this.formatCurrency(amount)} ${this.viewState.currencyLabel}`;
  }

  private releaseResizeListener(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }
}
