import { mediaPositionMs, type MediaStatus } from "../../domain";

export type MediaCommand = "previous" | "toggle" | "next";

export interface MediaCommandFeedback {
  message: string;
  failed: boolean;
}

export function mediaCommandEnabled(command: MediaCommand, current: MediaStatus): boolean {
  if (command === "previous") return current.canPrevious;
  if (command === "next") return current.canNext;
  return current.canPlayPause;
}

export function optimisticPlaybackToggle(current: MediaStatus): MediaStatus {
  const now = Date.now();
  return {
    ...current,
    playing: !current.playing,
    positionMs: current.playing ? mediaPositionMs(current, now) : current.positionMs,
    positionUpdatedAtMs: now,
  };
}

export function commandPendingMessage(command: MediaCommand, current: MediaStatus): string {
  if (command === "previous") return "Going to previous track…";
  if (command === "next") return "Going to next track…";
  return current.playing ? "Pausing…" : "Playing…";
}

export function mediaIdentityFor(current: MediaStatus): string {
  return `${current.sessionRevision}\u001f${current.source}\u001f${current.title}\u001f${current.artist}`;
}
