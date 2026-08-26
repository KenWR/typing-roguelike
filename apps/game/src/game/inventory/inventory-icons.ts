import Phaser from "phaser";

export const createInventoryBagIcon = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  color = 0x5eead4,
): Phaser.GameObjects.Graphics => {
  const graphics = scene.add.graphics().setPosition(x, y);
  const bodyWidth = size * 0.66;
  const bodyHeight = size * 0.5;
  const bodyX = -bodyWidth / 2;
  const bodyY = -size * 0.02;
  const radius = Math.max(2, size * 0.08);

  graphics.fillStyle(color, 0.2);
  graphics.fillRoundedRect(bodyX, bodyY, bodyWidth, bodyHeight, radius);
  graphics.lineStyle(Math.max(1, size * 0.08), color, 1);
  graphics.strokeRoundedRect(bodyX, bodyY, bodyWidth, bodyHeight, radius);
  graphics.beginPath();
  graphics.arc(0, bodyY, size * 0.2, Math.PI, 0, false);
  graphics.strokePath();
  graphics.lineBetween(bodyX, bodyY + bodyHeight * 0.34, bodyX + bodyWidth, bodyY + bodyHeight * 0.34);
  graphics.lineBetween(0, bodyY + bodyHeight * 0.2, 0, bodyY + bodyHeight * 0.48);

  return graphics;
};
