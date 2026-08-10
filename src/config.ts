import { normalizeLanguage, type UiLanguage } from "./i18n";

// Keep this primitive local: config is deliberately importable in isolation by
// the migration test harness. It mirrors shell/geometry.ts' 12 DIP host bleed.
const ISLAND_TOP_MARGIN = -12;

export interface AtollSettings {
  language: UiLanguage;
  hideInFullscreen: boolean;
  topMargin: number;
}

// This is product behavior, rather than a user preference: a short dwell keeps
// the island responsive without leaving the larger surface on screen too long.
export const EXPANDED_AUTO_COLLAPSE_MS = 4000;

export const DEFAULT_SETTINGS: AtollSettings = {
  language: "en",
  hideInFullscreen: true,
  topMargin: ISLAND_TOP_MARGIN,
};

const SETTINGS_KEY = "atoll.settings.v1";
const FIRST_RUN_KEY = "atoll.first-run-complete.v1";
const RETIRED_TIMER_KEY = "atoll.timer.v1";
const RETIRED_SETTING_KEYS = [
  "animationsEnabled",
  "soundsEnabled",
  "timerBreaksFullscreen",
  "idleMode",
  "compactTimeoutMs",
  "expandedTimeoutMs",
  "topMargin",
] as const;

export function loadSettings(): AtollSettings {
  removeRetiredTimerState();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const settings: AtollSettings = {
      language: normalizeLanguage(parsed.language),
      hideInFullscreen:
        typeof parsed.hideInFullscreen === "boolean"
          ? parsed.hideInFullscreen
          : DEFAULT_SETTINGS.hideInFullscreen,
      // The Status Island is deliberately fixed to one edge-attached anchor.
      // Older releases persisted this as a user-adjustable offset, which can
      // leave a migrated Island off its intended optical baseline.
      topMargin: ISLAND_TOP_MARGIN,
    };
    if (RETIRED_SETTING_KEYS.some((key) => key in parsed)) saveSettings(settings);
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function removeRetiredTimerState(): void {
  try {
    localStorage.removeItem(RETIRED_TIMER_KEY);
  } catch {
    // Retired data must not prevent current settings from loading.
  }
}

export function saveSettings(settings: AtollSettings): void {
  try {
    const { topMargin: _topMargin, ...persisted } = settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(persisted));
  } catch {
    // Settings remain valid for this session even if storage is unavailable.
  }
}

export function consumeFirstRun(): boolean {
  try {
    if (localStorage.getItem(FIRST_RUN_KEY) === "true") return false;
    localStorage.setItem(FIRST_RUN_KEY, "true");
    return true;
  } catch {
    return false;
  }
}
