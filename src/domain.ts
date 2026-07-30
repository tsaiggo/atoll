export type ShellState = "hidden" | "reef" | "compact" | "expanded";
export type ContentKind =
  | "idle"
  | "welcome"
  | "media"
  | "volume"
  | "timer"
  | "timer-finished"
  | "settings";

export interface MediaStatus {
  title: string;
  artist: string;
  source: string;
  playing: boolean;
  canPrevious: boolean;
  canPlayPause: boolean;
  canNext: boolean;
  artworkDataUrl?: string;
}

export interface VolumeStatus {
  level: number;
  muted: boolean;
}

export type TimerPhase = "idle" | "running" | "paused" | "finished";

export interface TimerStatus {
  phase: TimerPhase;
  durationMs: number;
  endAt: number | null;
  pausedRemainingMs: number | null;
}

export interface NativeMediaPayload {
  title?: string;
  artist?: string;
  source?: string;
  playing?: boolean;
  can_previous?: boolean;
  can_play_pause?: boolean;
  can_next?: boolean;
  artwork_data_url?: string | null;
}

export interface NativeVolumePayload {
  level: number;
  muted: boolean;
  initial?: boolean;
}

export const EMPTY_TIMER: TimerStatus = {
  phase: "idle",
  durationMs: 0,
  endAt: null,
  pausedRemainingMs: null,
};

export const DEMO_MEDIA: MediaStatus = {
  title: "Blue Hour",
  artist: "Maya Chen",
  source: "Atoll Demo",
  playing: true,
  canPrevious: true,
  canPlayPause: true,
  canNext: true,
};

export function normalizeMedia(payload: NativeMediaPayload): MediaStatus | null {
  const title = cleanText(payload.title);
  const artist = cleanText(payload.artist);
  if (!title && !artist) return null;
  return {
    title: title || "Unknown track",
    artist: artist || cleanText(payload.source) || "Unknown artist",
    source: cleanText(payload.source) || "Windows media",
    playing: Boolean(payload.playing),
    canPrevious: Boolean(payload.can_previous),
    canPlayPause: payload.can_play_pause !== false,
    canNext: Boolean(payload.can_next),
    artworkDataUrl: payload.artwork_data_url || undefined,
  };
}

export function createTimer(durationMinutes: number, now = Date.now()): TimerStatus {
  const durationMs = Math.max(1, Math.round(durationMinutes * 60_000));
  return {
    phase: "running",
    durationMs,
    endAt: now + durationMs,
    pausedRemainingMs: null,
  };
}

export function remainingMs(timer: TimerStatus, now = Date.now()): number {
  if (timer.phase === "paused") return Math.max(0, timer.pausedRemainingMs ?? 0);
  if (timer.phase === "running") return Math.max(0, (timer.endAt ?? now) - now);
  if (timer.phase === "finished") return 0;
  return timer.durationMs;
}

export function reconcileTimer(timer: TimerStatus, now = Date.now()): TimerStatus {
  if (timer.phase !== "running" || timer.endAt === null || timer.endAt > now) return timer;
  return { ...timer, phase: "finished", endAt: null, pausedRemainingMs: 0 };
}

export function pauseTimer(timer: TimerStatus, now = Date.now()): TimerStatus {
  if (timer.phase !== "running") return timer;
  return {
    ...timer,
    phase: "paused",
    endAt: null,
    pausedRemainingMs: remainingMs(timer, now),
  };
}

export function resumeTimer(timer: TimerStatus, now = Date.now()): TimerStatus {
  if (timer.phase !== "paused") return timer;
  const remaining = Math.max(0, timer.pausedRemainingMs ?? 0);
  if (remaining === 0) return { ...timer, phase: "finished", endAt: null };
  return {
    ...timer,
    phase: "running",
    endAt: now + remaining,
    pausedRemainingMs: null,
  };
}

export function restartTimer(timer: TimerStatus, now = Date.now()): TimerStatus {
  const durationMs = Math.max(1, timer.durationMs);
  return {
    phase: "running",
    durationMs,
    endAt: now + durationMs,
    pausedRemainingMs: null,
  };
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}
