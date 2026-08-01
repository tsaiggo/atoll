import { mediaPositionMs, type MediaStatus } from "../../domain";
import { copyFor, type UiLanguage } from "../../i18n";

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

export function commandPendingMessage(
  command: MediaCommand,
  current: MediaStatus,
  language: UiLanguage,
): string {
  const copy = copyFor(language).media;
  if (command === "previous") return copy.pendingPrevious;
  if (command === "next") return copy.pendingNext;
  return current.playing ? copy.pendingPause : copy.pendingPlay;
}

export function mediaIdentityFor(current: MediaStatus): string {
  return `${current.sessionRevision}\u001f${current.source}\u001f${current.title}\u001f${current.artist}`;
}
