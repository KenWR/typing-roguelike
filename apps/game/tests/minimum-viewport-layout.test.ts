import { describe, expect, test } from "bun:test";

class RectangleStub {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }
}

Object.assign(globalThis, {
  Phaser: {
    Geom: {
      Rectangle: RectangleStub,
    },
  },
});

const { createCombatLayout } = await import("../src/game/layout/combat-layout");
const { ENEMY_HEALTH_BAR_TRACK_Y, ENEMY_TELEGRAPH_TRACK_Y } = await import("../src/game/combat/enemy-health-bar");

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;

type RectLike = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

const right = (rect: RectLike): number => rect.x + rect.width;
const bottom = (rect: RectLike): number => rect.y + rect.height;

const isInsideViewport = (rect: RectLike): boolean =>
  rect.x >= 0 && rect.y >= 0 && right(rect) <= VIEWPORT_WIDTH && bottom(rect) <= VIEWPORT_HEIGHT;

const overlaps = (a: RectLike, b: RectLike): boolean =>
  a.x < right(b) && right(a) > b.x && a.y < bottom(b) && bottom(a) > b.y;

describe("1280x720 minimum viewport layout", () => {
  test("keeps all reserved combat UI regions inside the supported viewport", () => {
    const layout = createCombatLayout(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    expect(isInsideViewport(layout.relicHudReservation)).toBe(true);
    expect(isInsideViewport(layout.hudReservation)).toBe(true);
    expect(isInsideViewport(layout.enemyAttackGaugeReservation)).toBe(true);
    expect(isInsideViewport(layout.commandHudReservation)).toBe(true);
  });

  test("keeps the combat HUD and enemy attack gauge from overlapping", () => {
    const layout = createCombatLayout(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    expect(overlaps(layout.relicHudReservation, layout.hudReservation)).toBe(false);
    expect(overlaps(layout.relicHudReservation, layout.enemyAttackGaugeReservation)).toBe(false);
    expect(overlaps(layout.hudReservation, layout.enemyAttackGaugeReservation)).toBe(false);
  });

  test("keeps the command HUD below top information and actor anchors", () => {
    const layout = createCombatLayout(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    const topInformationBottom = Math.max(bottom(layout.hudReservation), bottom(layout.enemyAttackGaugeReservation));

    expect(topInformationBottom).toBeLessThan(layout.commandHudReservation.y);
    expect(layout.player.y).toBeLessThan(layout.commandHudReservation.y);
    expect(layout.enemy.y).toBeLessThan(layout.commandHudReservation.y);
  });

  test("places each enemy telegraph below its HP bar", () => {
    expect(ENEMY_TELEGRAPH_TRACK_Y).toBeGreaterThan(ENEMY_HEALTH_BAR_TRACK_Y);
  });
});
