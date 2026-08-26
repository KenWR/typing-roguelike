import { describe, expect, test } from "bun:test";
import {
  COMBAT_SOUND_KEYS,
  CombatFeedbackController,
} from "../src/game/feedback/combat-feedback";

describe("combat feedback", () => {
  test("plays a sound cue for every core gameplay feedback event", () => {
    const played: string[] = [];
    const feedback = new CombatFeedbackController({
      playSound: (key) => played.push(key),
      shakeCamera: () => undefined,
      isScreenShakeEnabled: () => true,
    });

    feedback.trigger("command-success");
    feedback.trigger("command-failure");
    feedback.trigger("player-hit");
    feedback.trigger("guard");
    feedback.trigger("victory");
    feedback.trigger("defeat");

    expect(played).toEqual([
      COMBAT_SOUND_KEYS["command-success"],
      COMBAT_SOUND_KEYS["command-failure"],
      COMBAT_SOUND_KEYS["player-hit"],
      COMBAT_SOUND_KEYS.guard,
      COMBAT_SOUND_KEYS.victory,
      COMBAT_SOUND_KEYS.defeat,
    ]);
  });

  test("screen shake is limited to player-hit and obeys the live setting", () => {
    let enabled = true;
    let shakes = 0;
    const feedback = new CombatFeedbackController({
      playSound: () => undefined,
      shakeCamera: () => { shakes += 1; },
      isScreenShakeEnabled: () => enabled,
    });

    feedback.trigger("command-success");
    feedback.trigger("guard");
    feedback.trigger("player-hit");
    expect(shakes).toBe(1);

    enabled = false;
    feedback.trigger("player-hit");
    expect(shakes).toBe(1);
  });

  test("audio or camera failures never interrupt gameplay feedback dispatch", () => {
    const feedback = new CombatFeedbackController({
      playSound: () => { throw new Error("audio unavailable"); },
      shakeCamera: () => { throw new Error("camera unavailable"); },
      isScreenShakeEnabled: () => true,
    });

    expect(() => feedback.trigger("command-success")).not.toThrow();
    expect(() => feedback.trigger("player-hit")).not.toThrow();
  });
});
