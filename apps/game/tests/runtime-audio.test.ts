import { describe, expect, test } from "bun:test";
import {
  RUNTIME_AUDIO_PATHS,
  playRuntimeBgm,
  playWalkSound,
  setRuntimeAudioSettings,
} from "../src/game/audio/runtime-audio";

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

  test("applies menu mute and volume to HTMLAudio BGM and SFX", async () => {
    class AudioStub {
      static instances: AudioStub[] = [];
      readonly src: string;
      preload = "";
      volume = 1;
      muted = false;
      loop = false;
      paused = true;
      currentTime = 0;

      constructor(src: string) {
        this.src = src;
        AudioStub.instances.push(this);
      }

      play(): Promise<void> {
        this.paused = false;
        return Promise.resolve();
      }

      pause(): void {
        this.paused = true;
      }
    }

    const originalAudio = globalThis.Audio;
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: AudioStub,
      writable: true,
    });

    try {
      setRuntimeAudioSettings({ muted: false, volume: 0.5 });
      playRuntimeBgm("menu");
      playWalkSound();
      await Promise.resolve();

      expect(AudioStub.instances).toHaveLength(2);
      expect(AudioStub.instances[0]).toMatchObject({
        src: RUNTIME_AUDIO_PATHS.menuBgm,
        muted: false,
        volume: 0.175,
      });
      expect(AudioStub.instances[1]).toMatchObject({
        src: RUNTIME_AUDIO_PATHS.walk,
        volume: 0.325,
      });

      setRuntimeAudioSettings({ muted: true, volume: 0 });
      expect(AudioStub.instances[0]).toMatchObject({ muted: true, volume: 0 });
      playWalkSound();
      expect(AudioStub.instances).toHaveLength(2);
    } finally {
      setRuntimeAudioSettings({ muted: false, volume: 1 });
      if (originalAudio === undefined) {
        Reflect.deleteProperty(globalThis, "Audio");
      } else {
        Object.defineProperty(globalThis, "Audio", {
          configurable: true,
          value: originalAudio,
          writable: true,
        });
      }
    }
  });
});
