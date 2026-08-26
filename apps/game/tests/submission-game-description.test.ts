import { describe, expect, test } from "bun:test";
import { GAME_SUBMISSION_DESCRIPTION } from "../src/submission/game-description.ts";

describe("submission game description", () => {
  test("stays within 200 characters", () => {
    expect([...GAME_SUBMISSION_DESCRIPTION].length).toBeLessThanOrEqual(200);
  });

  test("describes typing and real-time combat without unsupported claims", () => {
    expect(GAME_SUBMISSION_DESCRIPTION).toContain("타이핑");
    expect(GAME_SUBMISSION_DESCRIPTION).toContain("실시간");
    expect(GAME_SUBMISSION_DESCRIPTION).toContain("전투");
    expect(GAME_SUBMISSION_DESCRIPTION).toContain("장비");
  });
});
