import { describe, expect, test } from "bun:test";
import { RUNTIME_AUDIO_PATHS } from "../src/game/audio/runtime-audio";

describe("runtime audio assets", () => {
  test("maps menu, tower, boss, and impact cues to the bundled mp3 files", () => {
    expect(RUNTIME_AUDIO_PATHS).toEqual({
      menuBgm: "/assets/audio/전체 배경음.mp3",
      towerBgm: "/assets/audio/탑 등반음.mp3",
      bossBgm: "/assets/audio/보스전.mp3",
      impactHit: "/assets/audio/맞는소리 타격.mp3",
    });
  });
});
