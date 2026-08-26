export type MenuSettings = Readonly<{
  soundEnabled: boolean;
}>;

export const DEFAULT_MENU_SETTINGS: MenuSettings = Object.freeze({
  soundEnabled: true,
});

const STORAGE_KEY = "typing-roguelike.menu-settings";

export const toggleSound = (settings: MenuSettings): MenuSettings => ({
  ...settings,
  soundEnabled: !settings.soundEnabled,
});

export const loadMenuSettings = (storage?: Pick<Storage, "getItem">): MenuSettings => {
  if (!storage) return DEFAULT_MENU_SETTINGS;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MENU_SETTINGS;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof Reflect.get(parsed, "soundEnabled") === "boolean"
    ) {
      return { soundEnabled: Reflect.get(parsed, "soundEnabled") as boolean };
    }
  } catch {
    // Ignore unavailable/corrupt storage and fall back to defaults.
  }

  return DEFAULT_MENU_SETTINGS;
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
