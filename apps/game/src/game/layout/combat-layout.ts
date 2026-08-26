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

/** Local y offset of the enemy HP bar relative to its actor anchor. */
export const ENEMY_HEALTH_BAR_OFFSET_Y = -130;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function createCombatLayout(width: number, height: number): CombatLayout {
  const shortestSide = Math.min(width, height);
  const safeInset = clamp(shortestSide * 0.035, 12, 48);
  const actorScale = clamp(shortestSide / 760, 0.58, 1.15);
  const isCompact = width < 720;
  const contentWidth = Math.max(0, width - safeInset * 2);
  const relicHudHeight = 48;
  const topContentY = safeInset + relicHudHeight + 8;
  const hudHeight = isCompact ? clamp(height * 0.14, 96, 124) : clamp(height * 0.18, 72, 156);
  const enemyAttackGaugeHeight = isCompact ? clamp(height * 0.15, 112, 136) : hudHeight;
  const hudWidth = isCompact ? contentWidth : clamp(contentWidth * 0.34, 300, 420);
  const enemyAttackGaugeWidth = isCompact ? contentWidth : Math.min(420, contentWidth);
  const commandHudHeight = clamp(height * 0.2, 132, 172);
  const worldTop = topContentY + hudHeight;
  const playerX = clamp(width * 0.24, safeInset + 64, width * 0.42);
  const playerY = clamp(height * 0.64, worldTop + 80, height - safeInset - 70);
  const enemyX = clamp(width * 0.76, width * 0.58, width - safeInset - 64);
  const enemyY = clamp(height * 0.48, worldTop + 60, height - safeInset - 90);
  const enemyHealthBarTop = enemyY + ENEMY_HEALTH_BAR_OFFSET_Y * actorScale;
  const enemyAttackGaugeX = clamp(
    enemyX - enemyAttackGaugeWidth / 2,
    safeInset,
    Math.max(safeInset, width - safeInset - enemyAttackGaugeWidth),
  );
  const enemyAttackGaugeY = clamp(
    enemyHealthBarTop - enemyAttackGaugeHeight - 8,
    topContentY,
    Math.max(topContentY, height - safeInset - commandHudHeight - enemyAttackGaugeHeight - 8),
  );

  return {
    width,
    height,
    safeInset,
    actorScale,
    player: {
      x: playerX,
      y: playerY,
    },
    enemy: {
      x: enemyX,
      y: enemyY,
    },
    relicHudReservation: new Phaser.Geom.Rectangle(safeInset, safeInset, contentWidth, relicHudHeight),
    hudReservation: new Phaser.Geom.Rectangle(safeInset, topContentY, hudWidth, hudHeight),
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
