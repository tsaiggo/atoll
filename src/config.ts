import { normalizeLanguage, type UiLanguage } from "./i18n";

export type IdleMode = "reef" | "hidden";

export interface AtollSettings {
  language: UiLanguage;
  hideInFullscreen: boolean;
  idleMode: IdleMode;
  compactTimeoutMs: number;
  expandedTimeoutMs: number;
  topMargin: number;
}

export const DEFAULT_SETTINGS: AtollSettings = {
  language: "en",
  hideInFullscreen: true,
  idleMode: "reef",
  compactTimeoutMs: 3200,
  expandedTimeoutMs: 7000,
  topMargin: 0,
};

const SETTINGS_KEY = "atoll.settings.v1";
const FIRST_RUN_KEY = "atoll.first-run-complete.v1";
const RETIRED_TIMER_KEY = "atoll.timer.v1";
const RETIRED_SETTING_KEYS = [
  "animationsEnabled",
  "soundsEnabled",
  "timerBreaksFullscreen",
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
      idleMode: parsed.idleMode === "hidden" ? "hidden" : "reef",
      compactTimeoutMs: clampNumber(parsed.compactTimeoutMs, 1600, 10000, DEFAULT_SETTINGS.compactTimeoutMs),
      expandedTimeoutMs: clampNumber(parsed.expandedTimeoutMs, 3000, 30000, DEFAULT_SETTINGS.expandedTimeoutMs),
      topMargin: clampNumber(parsed.topMargin, 0, 48, DEFAULT_SETTINGS.topMargin),
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}
