import { defaultAppSettings } from "./api";
import type { AppSettings, ThemePreference } from "./api";
import { applyLanguage } from "./language";

const SETTINGS_CACHE_KEY = "discipline_app_settings";
const SETTINGS_UPDATED_EVENT = "discipline:settings-updated";

const accentTones = {
  indigo: { soft: "#a5b4fc", bright: "#c7d2fe", deep: "#818cf8" },
  violet: { soft: "#c4b5fd", bright: "#ddd6fe", deep: "#a78bfa" },
  blue: { soft: "#93c5fd", bright: "#bfdbfe", deep: "#60a5fa" },
  emerald: { soft: "#6ee7b7", bright: "#a7f3d0", deep: "#34d399" },
  rose: { soft: "#fda4af", bright: "#fecdd3", deep: "#fb7185" },
} as const;

export function mergeAppSettings(partial?: Partial<AppSettings> | null): AppSettings {
  return {
    account: { ...defaultAppSettings.account, ...partial?.account },
    notifications: { ...defaultAppSettings.notifications, ...partial?.notifications },
    discipline: { ...defaultAppSettings.discipline, ...partial?.discipline },
    appearance: { ...defaultAppSettings.appearance, ...partial?.appearance },
    date_calendar: { ...defaultAppSettings.date_calendar, ...partial?.date_calendar },
    journal: { ...defaultAppSettings.journal, ...partial?.journal },
    finance: { ...defaultAppSettings.finance, ...partial?.finance },
  };
}

export function readCachedAppSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_CACHE_KEY);
    return saved ? mergeAppSettings(JSON.parse(saved) as Partial<AppSettings>) : defaultAppSettings;
  } catch {
    return defaultAppSettings;
  }
}

export function cacheAppSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // The account API remains the source of truth if browser storage is unavailable.
  }
}

export function applyAppearance(theme: ThemePreference, accent: AppSettings["appearance"]["accent"], reduceAnimations?: boolean) {
  if (typeof document === "undefined") return;

  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
  const resolvedTheme = theme === "system" ? (prefersLight ? "light" : "dark") : theme;
  document.documentElement.dataset.theme = resolvedTheme;

  const tones = accentTones[accent];
  document.documentElement.style.setProperty("--color-indigo-300", tones.soft);
  document.documentElement.style.setProperty("--color-indigo-200", tones.bright);
  document.documentElement.style.setProperty("--color-indigo-400", tones.deep);
  document.documentElement.dataset.reduceMotion = (reduceAnimations ?? readCachedAppSettings().appearance.reduce_animations) ? "true" : "false";
}

export function applyCachedAppearance() {
  const settings = readCachedAppSettings();
  applyAppearance(settings.appearance.theme, settings.appearance.accent, settings.appearance.reduce_animations);
  applyLanguage(settings.appearance.language);
}

export function announceSettingsUpdated(settings: AppSettings) {
  window.dispatchEvent(new CustomEvent<AppSettings>(SETTINGS_UPDATED_EVENT, { detail: settings }));
}

export function settingsUpdatedEventName() {
  return SETTINGS_UPDATED_EVENT;
}
