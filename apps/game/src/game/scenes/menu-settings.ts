export type CommandLanguage = "ko" | "en";

export type MenuSettings = Readonly<{
  soundEnabled: boolean;
  volume: number;
  screenShakeEnabled: boolean;
  commandLanguage: CommandLanguage;
}>;

export const DEFAULT_MENU_SETTINGS: MenuSettings = Object.freeze({
  soundEnabled: true,
  volume: 1,
  screenShakeEnabled: true,
  commandLanguage: "ko",
});

export const MENU_SETTINGS_REGISTRY_KEYS = Object.freeze({
  screenShakeEnabled: "settings.screenShakeEnabled",
  commandLanguage: "settings.commandLanguage",
});

const STORAGE_KEY = "typing-roguelike.menu-settings";
const VOLUME_STEPS = [0, 0.5, 1] as const;

const clampVolume = (value: number): number => Math.min(1, Math.max(0, value));

export const toggleSound = (settings: MenuSettings): MenuSettings => ({
  ...settings,
  soundEnabled: !settings.soundEnabled,
});

export const cycleVolume = (settings: MenuSettings): MenuSettings => {
  const currentIndex = VOLUME_STEPS.findIndex((value) => value === settings.volume);
  const nextIndex = currentIndex < 0 ? VOLUME_STEPS.length - 1 : (currentIndex + 1) % VOLUME_STEPS.length;
  return { ...settings, volume: VOLUME_STEPS[nextIndex] };
};

export const toggleScreenShake = (settings: MenuSettings): MenuSettings => ({
  ...settings,
  screenShakeEnabled: !settings.screenShakeEnabled,
});

export const toggleCommandLanguage = (settings: MenuSettings): MenuSettings => ({
  ...settings,
  commandLanguage: settings.commandLanguage === "ko" ? "en" : "ko",
});

export const loadMenuSettings = (storage?: Pick<Storage, "getItem">): MenuSettings => {
  if (!storage) return DEFAULT_MENU_SETTINGS;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MENU_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_MENU_SETTINGS;

    const soundEnabled = typeof parsed.soundEnabled === "boolean"
      ? parsed.soundEnabled
      : DEFAULT_MENU_SETTINGS.soundEnabled;
    const volume = typeof parsed.volume === "number"
      ? clampVolume(parsed.volume)
      : DEFAULT_MENU_SETTINGS.volume;
    const screenShakeEnabled = typeof parsed.screenShakeEnabled === "boolean"
      ? parsed.screenShakeEnabled
      : DEFAULT_MENU_SETTINGS.screenShakeEnabled;
    const commandLanguage = parsed.commandLanguage === "en" || parsed.commandLanguage === "ko"
      ? parsed.commandLanguage
      : DEFAULT_MENU_SETTINGS.commandLanguage;

    return { soundEnabled, volume, screenShakeEnabled, commandLanguage };
  } catch {
    return DEFAULT_MENU_SETTINGS;
  }
};

export const saveMenuSettings = (
  settings: MenuSettings,
  storage?: Pick<Storage, "setItem">,
): void => {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Settings still apply for the current session even if persistence fails.
  }
};

export type MenuSettingsRuntime = {
  sound: { mute: boolean; volume: number };
  registry: { set: (key: string, value: unknown) => unknown };
};

export const applyMenuSettings = (runtime: MenuSettingsRuntime, settings: MenuSettings): void => {
  runtime.sound.mute = !settings.soundEnabled;
  runtime.sound.volume = settings.volume;
  runtime.registry.set(MENU_SETTINGS_REGISTRY_KEYS.screenShakeEnabled, settings.screenShakeEnabled);
  runtime.registry.set(MENU_SETTINGS_REGISTRY_KEYS.commandLanguage, settings.commandLanguage);
};
