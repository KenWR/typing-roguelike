import { describe, expect, test } from "bun:test";
import {
  ComboTracker,
  DEFAULT_COMBO_BONUS_TIERS,
} from "../src/game/combat/combo-tracker";

describe("ComboTracker", () => {
  test("increments combo on consecutive correct inputs", () => {
    const combo = new ComboTracker();

    expect(combo.recordCorrectInput()).toMatchObject({ count: 1, multiplier: 1 });
    expect(combo.recordCorrectInput()).toMatchObject({ count: 2, multiplier: 1 });
    expect(combo.recordCorrectInput()).toMatchObject({ count: 3, multiplier: 1 });
  });

  test("resets combo when a configured break condition is reported", () => {
    const combo = new ComboTracker();

    combo.recordCorrectInput();
    combo.recordCorrectInput();

    expect(combo.breakCombo("incorrect-input")).toEqual({
      count: 0,
      multiplier: 1,
      lastBreakReason: "incorrect-input",
    });
  });

  test("uses the highest matching default bonus tier", () => {
    const combo = new ComboTracker();

    for (let index = 0; index < 10; index += 1) {
      combo.recordCorrectInput();
    }

    expect(combo.snapshot).toMatchObject({ count: 10, multiplier: 1.25 });
    expect(combo.applyBonus(100)).toBe(125);
  });

  test("allows bonus thresholds and multipliers to be tuned as data", () => {
    const combo = new ComboTracker({
      bonusTiers: [
        { minimumCombo: 0, multiplier: 1 },
        { minimumCombo: 2, multiplier: 1.5 },
        { minimumCombo: 4, multiplier: 2 },
      ],
    });

    combo.recordCorrectInput();
    expect(combo.snapshot.multiplier).toBe(1);

    combo.recordCorrectInput();
    expect(combo.snapshot.multiplier).toBe(1.5);

    combo.recordCorrectInput();
    combo.recordCorrectInput();
    expect(combo.snapshot.multiplier).toBe(2);
  });

  test("accepts unordered tuning data and resolves it by threshold", () => {
    const combo = new ComboTracker({
      bonusTiers: [
        { minimumCombo: 5, multiplier: 1.5 },
        { minimumCombo: 0, multiplier: 1 },
        { minimumCombo: 2, multiplier: 1.2 },
      ],
    });

    combo.recordCorrectInput();
    combo.recordCorrectInput();
    expect(combo.snapshot.multiplier).toBe(1.2);
  });

  test("tracks different combo break reasons", () => {
    const combo = new ComboTracker();

    combo.recordCorrectInput();
    expect(combo.breakCombo("timeout").lastBreakReason).toBe("timeout");

    combo.recordCorrectInput();
    expect(combo.breakCombo("player-hit").lastBreakReason).toBe("player-hit");
  });

  test("rejects invalid tuning data and base values", () => {
    expect(() => new ComboTracker({ bonusTiers: [] })).toThrow(RangeError);
    expect(
      () =>
        new ComboTracker({
          bonusTiers: [{ minimumCombo: 1, multiplier: 1.1 }],
        }),
    ).toThrow(RangeError);
    expect(
      () =>
        new ComboTracker({
          bonusTiers: [
            { minimumCombo: 0, multiplier: 1 },
            { minimumCombo: 0, multiplier: 1.1 },
          ],
        }),
    ).toThrow(RangeError);

    const combo = new ComboTracker();
    expect(() => combo.applyBonus(-1)).toThrow(RangeError);
  });

  test("keeps the default combo tuning exported as data", () => {
    expect(DEFAULT_COMBO_BONUS_TIERS).toEqual([
      { minimumCombo: 0, multiplier: 1 },
      { minimumCombo: 5, multiplier: 1.1 },
      { minimumCombo: 10, multiplier: 1.25 },
      { minimumCombo: 20, multiplier: 1.5 },
    ]);
  });
});
