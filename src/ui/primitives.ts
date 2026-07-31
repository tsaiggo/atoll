import type { AtollSettings } from "../config";
import {
  formatDuration,
  formatPlaybackTime,
  mediaPositionMs,
  remainingMs,
  type MediaConnection,
  type MediaStatus,
} from "../domain";
import { icon } from "../icons";
import type { AppViewModel } from "../app/types";
import { escapeCssUrl, escapeHtml } from "./escape";

export function settingToggle(
  title: string,
  detail: string,
  settingName: keyof AtollSettings,
  checked: boolean,
): string {
  return `
    <button class="setting-row" type="button" role="switch" aria-checked="${checked}" data-action="toggle-setting" data-value="${settingName}">
      <span><strong>${title}</strong><small>${detail}</small></span>
      <span class="switch ${checked ? "is-on" : ""}" aria-hidden="true"><span></span></span>
    </button>`;
}

export function mediaButton(
  action: string,
  iconName: "previous" | "play" | "pause" | "next",
  label: string,
  enabled: boolean,
  primary = false,
  commandPending = false,
  isPending = false,
): string {
  return `
    <button class="media-button ${primary ? "media-button--primary" : ""} ${isPending ? "is-pending" : ""}" type="button" data-action="${action}" aria-label="${isPending ? `${label}, working` : label}" aria-busy="${isPending}" ${enabled ? "" : "disabled"} ${commandPending ? 'aria-disabled="true"' : ""}>
      ${icon(iconName)}
    </button>`;
}

export function renderMediaProgress(current: MediaStatus, now: number): string {
  if (current.positionMs === undefined || current.durationMs === undefined || current.durationMs <= 0) {
    return "";
  }
  const position = mediaPositionMs(current, now);
  const ratio = Math.min(1, Math.max(0, position / current.durationMs));
  const elapsedSeconds = Math.floor(position / 1000);
  const durationSeconds = Math.floor(current.durationMs / 1000);
  return `
    <div class="media-progress">
      <span class="media-progress__track" role="progressbar" aria-label="Playback progress" aria-valuemin="0" aria-valuemax="${durationSeconds}" aria-valuenow="${elapsedSeconds}" aria-valuetext="${formatPlaybackTime(position)} of ${formatPlaybackTime(current.durationMs)}">
        <span class="media-progress__fill" data-media-progress style="transform:scaleX(${ratio})"></span>
      </span>
      <span class="media-progress__time" aria-hidden="true"><span data-media-elapsed>${formatPlaybackTime(position)}</span><span>${formatPlaybackTime(current.durationMs)}</span></span>
    </div>`;
}

export function timerPresetButton(minutes: number): string {
  return `<button type="button" data-action="start-timer" data-value="${minutes}">${minutes} min</button>`;
}

export function renderCover(current: MediaStatus | null, className: string): string {
  const artwork = current?.artworkDataUrl;
  if (artwork?.startsWith("data:image/")) {
    return `<span class="${className} cover--image" style="background-image:url('${escapeCssUrl(artwork)}')" role="img" aria-label="Album artwork for ${escapeHtml(current?.title ?? "current media")}"></span>`;
  }
  return `<span class="${className} cover--brand" aria-hidden="true">${icon("atoll")}</span>`;
}

export function renderInlineVolume(vm: AppViewModel): string {
  if (!vm.showInlineVolume) return "";
  const percentage = Math.round(vm.volume.level * 100);
  return `<span class="inline-volume" role="meter" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" aria-valuetext="${vm.volume.muted ? `Muted, ${percentage} percent` : `${percentage} percent`}">${icon(vm.volume.muted ? "volumeMute" : "volume")}<span class="inline-volume__track" aria-hidden="true"><span style="transform:scaleX(${vm.volume.level})"></span></span><b>${percentage}</b></span>`;
}

export function compactAccessibleLabel(vm: AppViewModel): string {
  const expand = "Expand Atoll";
  switch (vm.content) {
    case "welcome":
      return `Atoll is ready. ${expand}`;
    case "media": {
      const title = vm.media?.title ?? "No active media";
      const artist = vm.media?.artist ? ` by ${vm.media.artist}` : "";
      const playback = vm.media ? (vm.media.playing ? "playing" : "paused") : "waiting for a session";
      return `${title}${artist}, ${playback}. ${expand}`;
    }
    case "volume": {
      const percentage = Math.round(vm.volume.level * 100);
      return `${vm.volume.muted ? "Muted" : `Volume ${percentage} percent`}. ${expand}`;
    }
    case "timer":
      return `Focus timer, ${formatDuration(remainingMs(vm.timer, vm.now))} remaining, ${vm.timer.phase === "paused" ? "paused" : "running"}. ${expand}`;
    case "timer-finished":
      return `Focus timer complete. ${expand}`;
    default:
      return `Atoll. ${expand}`;
  }
}

export function homeStatusLine(vm: AppViewModel): string {
  if (vm.timer.phase === "running") return `${formatDuration(remainingMs(vm.timer, vm.now))} remaining`;
  if (vm.media?.playing) return "Media is playing";
  return "Your status, surfaced.";
}

export function mediaEmptyCopy(mediaConnection: MediaConnection): { title: string; detail: string } {
  switch (mediaConnection.status) {
    case "checking":
      return {
        title: "Checking Windows media…",
        detail: "Looking for connected players",
      };
    case "metadata_unavailable":
      return {
        title: "Player connected",
        detail: "It isn’t sharing track details with Windows",
      };
    case "unavailable":
      return {
        title: "Media controls unavailable",
        detail: "Atoll couldn’t reach Windows media sessions",
      };
    default:
      return {
        title: "No active media",
        detail: "Start playback in QQ Music or another player",
      };
  }
}
