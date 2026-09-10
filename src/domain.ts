export type ShellState = "hidden" | "reef" | "compact" | "expanded";
export type ContentKind =
  | "idle"
  | "welcome"
  | "media"
  | "settings";

export interface MediaStatus {
  title: string;
  artist: string;
  source: string;
  playing: boolean;
  canPrevious: boolean;
  canPlayPause: boolean;
  canNext: boolean;
  canSeek: boolean;
  positionMs?: number;
  durationMs?: number;
  positionUpdatedAtMs: number;
  sessionRevision: number;
  artworkDataUrl?: string;
}

export type MediaConnectStatus =
  | "checking"
  | "ready"
  | "no_session"
  | "metadata_unavailable"
  | "unavailable";

export interface MediaConnection {
  status: MediaConnectStatus;
  sessionCount: number;
  sources: readonly MediaSource[];
  manualSource: MediaSourceSelection | null;
}

// A source is a media-producing application, not an individual browser tab or
// player window. Windows exposes this boundary as an App User Model ID.
export interface MediaSource {
  providerId: string;
  sourceId: string;
  label: string;
  sessionCount: number;
}

export interface MediaSourceSelection {
  providerId: string;
  sourceId: string;
}

// Energy is deliberately scoped to battery discharge. Windows cannot
// reliably report the wall-side energy use of every PC, so this value is
// surfaced as the laptop battery energy used today rather than a utility-bill
// measurement.
export interface EnergyStatus {
  available: boolean;
  todayMwh: number;
  dayKey: string;
  trackingSinceMs: number;
  partial: boolean;
  // Completed local days only. The active day remains a separate live value so
  // the history surface never presents an in-progress measurement as final.
  history: readonly EnergyHistoryEntry[];
  source: "battery_discharge";
}

export interface EnergyHistoryEntry {
  dayKey: string;
  totalMwh: number;
  partial: boolean;
}

export type CodexUsageConnectStatus =
  | "disabled"
  | "checking"
  | "ready"
  | "signed_out"
  | "unsupported_auth"
  | "cli_missing"
  | "unavailable"
  | "protocol_error";

// The Codex App Server data exposed to the WebView is intentionally limited
// to aggregated local usage windows. It must never carry account identity,
// prompts, files, credentials, or raw App Server messages.
export interface CodexUsageStatus {
  enabled: boolean;
  status: CodexUsageConnectStatus;
  windows: readonly CodexUsageWindow[];
  dailyUsage: readonly CodexDailyUsage[];
  activityAvailable: boolean;
  updatedAtMs: number | null;
  source: "codex_app_server";
}

export interface CodexUsageWindow {
  id: string;
  label: string | null;
  usedPercent: number;
  windowDurationMins: number;
  resetsAtMs: number;
  reached: boolean;
}

export interface CodexDailyUsage {
  dayKey: string;
  tokens: number;
}

export interface NativeMediaPayload {
  title?: string;
  artist?: string;
  source?: string;
  playing?: boolean;
  can_previous?: boolean;
  can_play_pause?: boolean;
  can_next?: boolean;
  can_seek?: boolean;
  position_ms?: number | null;
  duration_ms?: number | null;
  position_updated_at_ms?: number | null;
  session_revision?: number;
  artwork_data_url?: string | null;
}

export interface NativeMediaSourcePayload {
  provider_id?: string;
  source_id?: string;
  label?: string;
  session_count?: number;
}

export interface NativeMediaSourceSelectionPayload {
  provider_id?: string;
  source_id?: string;
}

export interface NativeMediaUpdatePayload {
  status?: MediaConnectStatus;
  session_count?: number;
  sources?: readonly NativeMediaSourcePayload[];
  manual_source?: NativeMediaSourceSelectionPayload | null;
  media?: NativeMediaPayload | null;
}

export interface NativeEnergyPayload {
  available?: boolean;
  today_mwh?: number | null;
  day_key?: string | null;
  tracking_since_ms?: number | null;
  partial?: boolean;
  history?: readonly NativeEnergyHistoryPayload[];
  source?: string | null;
}

export interface NativeEnergyHistoryPayload {
  day_key?: string | null;
  total_mwh?: number | null;
  partial?: boolean;
}

export interface NativeCodexUsagePayload {
  enabled?: boolean;
  status?: string;
  windows?: readonly NativeCodexUsageWindowPayload[];
  daily_usage?: readonly NativeCodexDailyUsagePayload[];
  activity_available?: boolean;
  updated_at_ms?: number | null;
  source?: string;
}

export interface NativeCodexUsageWindowPayload {
  id?: string;
  label?: string | null;
  used_percent?: number;
  window_duration_mins?: number;
  resets_at_ms?: number;
  reached?: boolean;
}

export interface NativeCodexDailyUsagePayload {
  day_key?: string;
  tokens?: number;
}

export const DEMO_MEDIA: MediaStatus = {
  title: "Blue Hour",
  artist: "Maya Chen",
  source: "Atoll Demo",
  playing: true,
  canPrevious: true,
  canPlayPause: true,
  canNext: true,
  canSeek: true,
  positionMs: 73_000,
  durationMs: 232_000,
  positionUpdatedAtMs: Date.now(),
  sessionRevision: 1,
};

export const DEMO_MEDIA_SOURCES: readonly MediaSource[] = [
  {
    providerId: "builtin.windows-media-session",
    sourceId: "atoll.demo.player",
    label: "Atoll Demo",
    sessionCount: 1,
  },
  {
    providerId: "builtin.windows-media-session",
    sourceId: "atoll.demo.browser",
    label: "Browser player",
    sessionCount: 1,
  },
];

export const DEMO_ENERGY: EnergyStatus = {
  available: true,
  todayMwh: 42_000,
  dayKey: "2026-08-08",
  trackingSinceMs: Date.now() - 6 * 60 * 60 * 1_000,
  partial: false,
  history: Array.from({ length: 29 }, (_, index) => ({
    dayKey: new Date(Date.UTC(2026, 6, 10 + index)).toISOString().slice(0, 10),
    totalMwh: index === 8 ? 0 : (12 + index * 13 % 54) * 1_000,
    partial: index === 11 || index === 24,
  })).filter((_, index) => ![5, 17, 23].includes(index)),
  source: "battery_discharge",
};

export const DEMO_CODEX_USAGE: CodexUsageStatus = {
  enabled: true,
  status: "ready",
  windows: [
    {
      id: "primary",
      label: "5-hour limit",
      usedPercent: 32,
      windowDurationMins: 300,
      resetsAtMs: Date.now() + 84 * 60 * 1_000,
      reached: false,
    },
    {
      id: "secondary",
      label: "Weekly limit",
      usedPercent: 14,
      windowDurationMins: 10_080,
      resetsAtMs: Date.now() + 3 * 24 * 60 * 60 * 1_000,
      reached: false,
    },
  ],
  dailyUsage: [],
  activityAvailable: false,
  updatedAtMs: Date.now(),
  source: "codex_app_server",
};

export function normalizeEnergy(
  payload: NativeEnergyPayload | null | undefined,
): EnergyStatus {
  const todayMwh = optionalNonNegativeNumber(payload?.today_mwh);
  const available = payload?.available === true && todayMwh !== undefined;
  const dayKey = cleanEnergyDayKey(payload?.day_key);
  return {
    available,
    todayMwh: todayMwh ?? 0,
    dayKey,
    trackingSinceMs: optionalNonNegativeNumber(payload?.tracking_since_ms) ?? 0,
    partial: available && payload?.partial === true,
    history: normalizeEnergyHistory(payload?.history, dayKey),
    // The current MVP has one honest source and must not imply wall power.
    source: "battery_discharge",
  };
}

export function normalizeCodexUsage(
  payload: NativeCodexUsagePayload | null | undefined,
): CodexUsageStatus {
  const enabled = payload?.enabled === true;
  const status = normalizeCodexUsageStatus(payload?.status, enabled);
  return {
    enabled,
    status,
    windows: normalizeCodexUsageWindows(payload?.windows),
    dailyUsage: normalizeCodexDailyUsage(payload?.daily_usage),
    activityAvailable: payload?.activity_available === true,
    updatedAtMs: optionalNonNegativeNumber(payload?.updated_at_ms) ?? null,
    source: "codex_app_server",
  };
}

function normalizeCodexUsageStatus(
  value: string | undefined,
  enabled: boolean,
): CodexUsageConnectStatus {
  switch (value) {
    case "disabled":
    case "checking":
    case "ready":
    case "signed_out":
    case "unsupported_auth":
    case "cli_missing":
    case "unavailable":
    case "protocol_error":
      return value;
    default:
      return enabled ? "unavailable" : "disabled";
  }
}

function normalizeCodexUsageWindows(
  payload: readonly NativeCodexUsageWindowPayload[] | undefined,
): CodexUsageWindow[] {
  if (!Array.isArray(payload)) return [];

  const windows = new Map<string, CodexUsageWindow>();
  for (const raw of payload) {
    const id = cleanIdentifier(raw?.id);
    const usedPercent = optionalPercentage(raw?.used_percent);
    const windowDurationMins = optionalPositiveInteger(raw?.window_duration_mins);
    const resetsAtMs = optionalPositiveInteger(raw?.resets_at_ms);
    if (!id || usedPercent === undefined || !windowDurationMins || !resetsAtMs) continue;
    windows.set(id, {
      id,
      label: cleanText(raw?.label ?? undefined) || null,
      usedPercent,
      windowDurationMins,
      resetsAtMs,
      reached: raw?.reached === true,
    });
  }
  // Preserve the bounded native set through normalization. Presentation picks
  // the top two only after ranking, so source ordering cannot hide a tighter
  // third window.
  return [...windows.values()].slice(0, 16);
}

function normalizeCodexDailyUsage(
  payload: readonly NativeCodexDailyUsagePayload[] | undefined,
): CodexDailyUsage[] {
  if (!Array.isArray(payload)) return [];

  const days = new Map<string, CodexDailyUsage>();
  for (const raw of payload) {
    const dayKey = cleanEnergyDayKey(raw?.day_key);
    const tokens = optionalNonNegativeNumber(raw?.tokens);
    if (!dayKey || tokens === undefined) continue;
    days.set(dayKey, { dayKey, tokens: Math.floor(tokens) });
  }
  return [...days.values()]
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey))
    .slice(0, 30);
}

export interface CodexUsageWindowSelection {
  primary: CodexUsageWindow | null;
  secondary: CodexUsageWindow | null;
}

// The window nearest its effective limit leads. A deterministic tie-breaker
// makes the UI stable when an App Server updates windows in a different order.
export function selectCodexUsageWindows(
  windows: readonly CodexUsageWindow[],
): CodexUsageWindowSelection {
  const sorted = [...windows].sort((left, right) => {
    if (left.reached !== right.reached) return left.reached ? -1 : 1;
    if (left.usedPercent !== right.usedPercent) return right.usedPercent - left.usedPercent;
    if (left.resetsAtMs !== right.resetsAtMs) return left.resetsAtMs - right.resetsAtMs;
    return left.id.localeCompare(right.id);
  });
  return {
    primary: sorted[0] ?? null,
    secondary: sorted[1] ?? null,
  };
}

export function formatCodexUsagePercent(value: number, language: "en" | "zh-CN"): string {
  const locale = language === "zh-CN" ? "zh-CN" : "en-US";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

export function formatCodexResetCountdown(
  resetsAtMs: number,
  language: "en" | "zh-CN",
  now = Date.now(),
): string | null {
  if (!Number.isFinite(resetsAtMs) || resetsAtMs <= now) return null;
  const remainingMs = resetsAtMs - now;
  if (remainingMs < 60_000) return language === "zh-CN" ? "少于 1 分钟" : "< 1m";

  const remainingMinutes = Math.floor(remainingMs / 60_000);
  if (remainingMinutes < 60) {
    return language === "zh-CN" ? `${remainingMinutes} 分钟` : `${remainingMinutes}m`;
  }

  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  if (hours < 24) {
    return language === "zh-CN"
      ? `${hours} 小时${minutes ? ` ${minutes} 分钟` : ""}`
      : `${hours}h${minutes ? ` ${minutes}m` : ""}`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return language === "zh-CN"
    ? `${days} 天${remainingHours ? ` ${remainingHours} 小时` : ""}`
    : `${days}d${remainingHours ? ` ${remainingHours}h` : ""}`;
}

export type CodexUsageSignalKind = "threshold-80" | "threshold-95" | "reached" | "reset";

export interface CodexUsageSignal {
  kind: CodexUsageSignalKind;
  windowId: string;
  resetsAtMs: number;
}

export function codexUsageSignalKey(signal: CodexUsageSignal): string {
  return `${signal.kind}:${signal.windowId}:${signal.resetsAtMs}`;
}

// Events need a real transition rather than a snapshot, otherwise reopening
// Atoll near a limit would repeatedly interrupt the user with a stale alert.
export function codexUsageTransition(
  previous: CodexUsageStatus | null,
  next: CodexUsageStatus,
): CodexUsageSignal | null {
  if (
    !previous ||
    !previous.enabled ||
    !next.enabled ||
    previous.status !== "ready" ||
    next.status !== "ready"
  ) {
    return null;
  }

  const priorWindows = new Map(previous.windows.map((window) => [window.id, window]));
  const signals: CodexUsageSignal[] = [];
  for (const current of next.windows) {
    const prior = priorWindows.get(current.id);
    if (!prior) continue;

    const snapshotAdvanced =
      previous.updatedAtMs === null ||
      next.updatedAtMs === null ||
      next.updatedAtMs > previous.updatedAtMs;
    if (
      snapshotAdvanced &&
      current.resetsAtMs > prior.resetsAtMs &&
      current.usedPercent < prior.usedPercent &&
      (prior.reached || prior.usedPercent >= 80)
    ) {
      signals.push({ kind: "reset", windowId: current.id, resetsAtMs: current.resetsAtMs });
      continue;
    }

    const priorReached = prior.reached || prior.usedPercent >= 100;
    const currentReached = current.reached || current.usedPercent >= 100;
    if (!priorReached && currentReached) {
      signals.push({ kind: "reached", windowId: current.id, resetsAtMs: current.resetsAtMs });
    } else if (prior.usedPercent < 95 && current.usedPercent >= 95) {
      signals.push({ kind: "threshold-95", windowId: current.id, resetsAtMs: current.resetsAtMs });
    } else if (prior.usedPercent < 80 && current.usedPercent >= 80) {
      signals.push({ kind: "threshold-80", windowId: current.id, resetsAtMs: current.resetsAtMs });
    }
  }

  const priority: Record<CodexUsageSignalKind, number> = {
    reached: 4,
    "threshold-95": 3,
    "threshold-80": 2,
    reset: 1,
  };
  return signals.sort((left, right) => priority[right.kind] - priority[left.kind])[0] ?? null;
}

function normalizeEnergyHistory(
  payload: readonly NativeEnergyHistoryPayload[] | undefined,
  activeDayKey: string,
): EnergyHistoryEntry[] {
  if (!Array.isArray(payload)) return [];

  const byDay = new Map<string, EnergyHistoryEntry>();
  for (const entry of payload) {
    const dayKey = cleanEnergyDayKey(entry?.day_key);
    const totalMwh = optionalNonNegativeNumber(entry?.total_mwh);
    if (!dayKey || dayKey === activeDayKey || totalMwh === undefined) continue;
    byDay.set(dayKey, {
      dayKey,
      totalMwh,
      partial: entry?.partial === true,
    });
  }

  return [...byDay.values()]
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey))
    .slice(0, 30);
}

export interface EnergyMeasurement {
  readonly value: string;
  readonly unit: string;
}

// Keep an honest, visibly changing reading at small values. Battery telemetry
// arrives in mWh, where a 0.06 Wh discharge is real but would round to 0.00
// when presented only as kWh. The unit steps up once the value is meaningful.
export function formatEnergyMeasurement(
  milliwattHours: number,
  language: "en" | "zh-CN",
): EnergyMeasurement {
  const normalizedMwh = Number.isFinite(milliwattHours) ? Math.max(0, milliwattHours) : 0;
  const locale = language === "zh-CN" ? "zh-CN" : "en-US";
  const twoDecimal = (value: number): string => new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  if (normalizedMwh > 0 && normalizedMwh < 10) {
    return {
      value: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(normalizedMwh),
      unit: "mWh",
    };
  }
  if (normalizedMwh < 1_000_000) {
    return { value: twoDecimal(normalizedMwh / 1_000), unit: "Wh" };
  }
  return {
    value: twoDecimal(normalizedMwh / 1_000_000),
    unit: language === "zh-CN" ? "度" : "kWh",
  };
}

export function normalizeMedia(payload: NativeMediaPayload): MediaStatus | null {
  const title = cleanText(payload.title);
  const artist = cleanText(payload.artist);
  const source = cleanText(payload.source);
  if (!title && !artist && !source) return null;
  const durationMs = optionalNonNegativeNumber(payload.duration_ms);
  const rawPositionMs = optionalNonNegativeNumber(payload.position_ms);
  const positionMs =
    rawPositionMs === undefined
      ? undefined
      : durationMs === undefined
        ? rawPositionMs
        : Math.min(rawPositionMs, durationMs);
  const updatedAt = optionalNonNegativeNumber(payload.position_updated_at_ms);
  return {
    title: title || "Untitled media",
    artist: artist || source || "Unknown artist",
    source: source || "Windows media",
    playing: Boolean(payload.playing),
    canPrevious: Boolean(payload.can_previous),
    canPlayPause: Boolean(payload.can_play_pause),
    canNext: Boolean(payload.can_next),
    canSeek: Boolean(payload.can_seek),
    positionMs,
    durationMs,
    positionUpdatedAtMs: updatedAt ?? Date.now(),
    sessionRevision: optionalNonNegativeNumber(payload.session_revision) ?? 0,
    artworkDataUrl: payload.artwork_data_url || undefined,
  };
}

export function normalizeMediaSources(
  payload: readonly NativeMediaSourcePayload[] | undefined,
): MediaSource[] {
  if (!Array.isArray(payload)) return [];
  const sources = new Map<string, MediaSource>();
  for (const raw of payload) {
    const providerId = cleanIdentifier(raw.provider_id);
    const sourceId = cleanIdentifier(raw.source_id);
    if (!providerId || !sourceId) continue;
    const key = `${providerId}\u0000${sourceId}`;
    const sessionCount = Math.max(
      0,
      Math.floor(optionalNonNegativeNumber(raw.session_count) ?? 0),
    );
    const existing = sources.get(key);
    if (existing) {
      existing.sessionCount += sessionCount;
      continue;
    }
    sources.set(key, {
      providerId,
      sourceId,
      label: cleanText(raw.label) || "Windows media",
      sessionCount,
    });
  }
  return [...sources.values()];
}

export function normalizeMediaSourceSelection(
  payload: NativeMediaSourceSelectionPayload | null | undefined,
  sources: readonly MediaSource[],
): MediaSourceSelection | null {
  const providerId = cleanIdentifier(payload?.provider_id);
  const sourceId = cleanIdentifier(payload?.source_id);
  if (!providerId || !sourceId) return null;
  return sources.some(
    (source) => source.providerId === providerId && source.sourceId === sourceId,
  )
    ? { providerId, sourceId }
    : null;
}

export function formatPlaybackTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function mediaPositionMs(media: MediaStatus, now = Date.now()): number {
  const base = Math.max(0, media.positionMs ?? 0);
  const elapsed = media.playing ? Math.max(0, now - media.positionUpdatedAtMs) : 0;
  const position = base + elapsed;
  return media.durationMs === undefined ? position : Math.min(position, media.durationMs);
}

function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function cleanIdentifier(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 512);
}

function cleanEnergyDayKey(value: string | null | undefined): string {
  const dayKey = (value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return "";
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? dayKey
    : "";
}

function optionalNonNegativeNumber(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

function optionalPositiveInteger(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return undefined;
  return value;
}

function optionalPercentage(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    return undefined;
  }
  return value;
}
