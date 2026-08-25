export type CombatLayout = {
  width: number;
  height: number;
  safeInset: number;
  actorScale: number;
  player: { x: number; y: number };
  enemy: { x: number; y: number };
  hudReservation: Phaser.Geom.Rectangle;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function createCombatLayout(width: number, height: number): CombatLayout {
  const shortestSide = Math.min(width, height);
  const safeInset = clamp(shortestSide * 0.035, 12, 48);
  const actorScale = clamp(shortestSide / 760, 0.58, 1.15);
  const hudHeight = clamp(height * 0.18, 72, 156);

  return {
    width,
    height,
    safeInset,
    actorScale,
    player: {
      x: clamp(width * 0.24, safeInset + 64, width * 0.42),
      y: clamp(height * 0.64, hudHeight + 100, height - safeInset - 70),
    },
    enemy: {
      x: clamp(width * 0.76, width * 0.58, width - safeInset - 64),
      y: clamp(height * 0.48, hudHeight + 80, height - safeInset - 90),
    },
    hudReservation: new Phaser.Geom.Rectangle(
      safeInset,
      safeInset,
      Math.max(0, width - safeInset * 2),
      hudHeight,
    ),
  };
}
