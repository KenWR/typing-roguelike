export type CombatLayout = {
  width: number;
  height: number;
  safeInset: number;
  actorScale: number;
  player: { x: number; y: number };
  enemy: { x: number; y: number };
  relicHudReservation: Phaser.Geom.Rectangle;
  hudReservation: Phaser.Geom.Rectangle;
  enemyAttackGaugeReservation: Phaser.Geom.Rectangle;
  commandHudReservation: Phaser.Geom.Rectangle;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function createCombatLayout(width: number, height: number): CombatLayout {
  const shortestSide = Math.min(width, height);
  const safeInset = clamp(shortestSide * 0.035, 12, 48);
  const actorScale = clamp(shortestSide / 760, 0.58, 1.15);
  const isCompact = width < 720;
  const contentWidth = Math.max(0, width - safeInset * 2);
  const relicHudHeight = 48;
  const topContentY = safeInset + relicHudHeight + 8;
  const hudHeight = isCompact
    ? clamp(height * 0.14, 96, 124)
    : clamp(height * 0.18, 72, 156);
  const enemyAttackGaugeHeight = isCompact
    ? clamp(height * 0.15, 112, 136)
    : hudHeight;
  const hudWidth = isCompact
    ? contentWidth
    : clamp(contentWidth * 0.34, 300, 420);
  const hudGap = isCompact ? 0 : 12;
  const enemyAttackGaugeX = isCompact
    ? safeInset
    : safeInset + hudWidth + hudGap;
  const enemyAttackGaugeY = isCompact
    ? topContentY + hudHeight + 8
    : topContentY;
  const enemyAttackGaugeWidth = isCompact
    ? contentWidth
    : Math.max(0, contentWidth - hudWidth - hudGap);
  const commandHudHeight = clamp(height * 0.2, 132, 172);
  const worldTop = Math.max(
    topContentY + hudHeight,
    enemyAttackGaugeY + enemyAttackGaugeHeight,
  );

  return {
    width,
    height,
    safeInset,
    actorScale,
    player: {
      x: clamp(width * 0.24, safeInset + 64, width * 0.42),
      y: clamp(height * 0.64, worldTop + 80, height - safeInset - 70),
    },
    enemy: {
      x: clamp(width * 0.76, width * 0.58, width - safeInset - 64),
      y: clamp(height * 0.48, worldTop + 60, height - safeInset - 90),
    },
    relicHudReservation: new Phaser.Geom.Rectangle(
      safeInset,
      safeInset,
      contentWidth,
      relicHudHeight,
    ),
    hudReservation: new Phaser.Geom.Rectangle(
      safeInset,
      topContentY,
      hudWidth,
      hudHeight,
    ),
    enemyAttackGaugeReservation: new Phaser.Geom.Rectangle(
      enemyAttackGaugeX,
      enemyAttackGaugeY,
      enemyAttackGaugeWidth,
      enemyAttackGaugeHeight,
    ),
    commandHudReservation: new Phaser.Geom.Rectangle(
      safeInset,
      Math.max(safeInset, height - safeInset - commandHudHeight),
      Math.max(0, width - safeInset * 2),
      commandHudHeight,
    ),
  };
}
