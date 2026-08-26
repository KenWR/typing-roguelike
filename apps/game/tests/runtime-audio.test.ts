import { describe, expect, test } from "bun:test";
import { RUNTIME_AUDIO_PATHS } from "../src/game/audio/runtime-audio";

describe("runtime audio assets", () => {
  test("maps BGM, hit, weapon, reward, and shop cues to bundled mp3 files", () => {
    expect(RUNTIME_AUDIO_PATHS.menuBgm).toBe("/assets/audio/전체 배경음.mp3");
    expect(RUNTIME_AUDIO_PATHS.towerBgm).toBe("/assets/audio/탑 등반음.mp3");
    expect(RUNTIME_AUDIO_PATHS.bossBgm).toBe("/assets/audio/보스전.mp3");
    expect(RUNTIME_AUDIO_PATHS.normalHits).toEqual([
      "/assets/audio/맞는소리 타격.mp3",
      "/assets/audio/맞는소리2.mp3",
      "/assets/audio/맞는소리3.mp3",
    ]);
    expect(RUNTIME_AUDIO_PATHS.strongHit).toBe("/assets/audio/맞는소리 강하게.mp3");
    expect(RUNTIME_AUDIO_PATHS.block).toBe("/assets/audio/막는소리.mp3");
    expect(RUNTIME_AUDIO_PATHS.magic).toBe("/assets/audio/마법소리.mp3");
    expect(RUNTIME_AUDIO_PATHS.blunt).toBe("/assets/audio/둔기.mp3");
    expect(RUNTIME_AUDIO_PATHS.slashes).toEqual([
      "/assets/audio/칼질 1.mp3",
      "/assets/audio/칼질 2.mp3",
    ]);
    expect(RUNTIME_AUDIO_PATHS.bow).toBe("/assets/audio/활.mp3");
    expect(RUNTIME_AUDIO_PATHS.relicPickup).toBe("/assets/audio/유물 줍는 소리.mp3");
    expect(RUNTIME_AUDIO_PATHS.coin).toBe("/assets/audio/동전.mp3");
    expect(RUNTIME_AUDIO_PATHS.walk).toBe("/assets/audio/걷는소리.mp3");
  });
});
