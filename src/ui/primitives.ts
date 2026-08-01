import type { AtollSettings } from "../config";
import {
  formatPlaybackTime,
  mediaPositionMs,
  type MediaConnection,
  type MediaStatus,
} from "../domain";
import { icon } from "../icons";
import { copyFor, type UiLanguage } from "../i18n";
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
  language: UiLanguage,
  primary = false,
  commandPending = false,
  isPending = false,
): string {
  const accessibleLabel = isPending ? copyFor(language).actions.working(label) : label;
  return `
    <button class="media-button ${primary ? "media-button--primary" : ""} ${isPending ? "is-pending" : ""}" type="button" data-action="${action}" aria-label="${accessibleLabel}" aria-busy="${isPending}" ${enabled ? "" : "disabled"} ${commandPending ? 'aria-disabled="true"' : ""}>
      ${icon(iconName)}
    </button>`;
}

export function renderMediaProgress(
  current: MediaStatus,
  now: number,
  language: UiLanguage,
): string {
  if (current.positionMs === undefined || current.durationMs === undefined || current.durationMs <= 0) {
    return "";
  }
  const position = mediaPositionMs(current, now);
  const ratio = Math.min(1, Math.max(0, position / current.durationMs));
  const elapsedSeconds = Math.floor(position / 1000);
  const durationSeconds = Math.floor(current.durationMs / 1000);
  const copy = copyFor(language).media;
  const elapsed = formatPlaybackTime(position);
  const duration = formatPlaybackTime(current.durationMs);
  return `
    <div class="media-progress">
      <span class="media-progress__track" role="progressbar" aria-label="${copy.progress}" aria-valuemin="0" aria-valuemax="${durationSeconds}" aria-valuenow="${elapsedSeconds}" aria-valuetext="${copy.progressValue(elapsed, duration)}">
        <span class="media-progress__fill" data-media-progress style="transform:scaleX(${ratio})"></span>
      </span>
      <span class="media-progress__time" aria-hidden="true"><span data-media-elapsed>${elapsed}</span><span>${duration}</span></span>
    </div>`;
}

export function renderCover(
  current: MediaStatus | null,
  className: string,
  language: UiLanguage,
): string {
  const artwork = current?.artworkDataUrl;
  if (artwork?.startsWith("data:image/")) {
    const title = current?.title ?? copyFor(language).media.noMedia;
    return `<span class="${className} cover--image" style="background-image:url('${escapeCssUrl(artwork)}')" role="img" aria-label="${escapeHtml(copyFor(language).media.coverAlt(title))}"></span>`;
  }
  return `<span class="${className} cover--brand" aria-hidden="true">${icon("atoll")}</span>`;
}

export function renderInlineVolume(vm: AppViewModel): string {
  if (!vm.showInlineVolume) return "";
  const percentage = Math.round(vm.volume.level * 100);
  const copy = copyFor(vm.settings.language).volume;
  return `<span class="inline-volume" role="meter" aria-label="${copy.title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" aria-valuetext="${copy.accessibleValue(percentage, vm.volume.muted)}">${icon(vm.volume.muted ? "volumeMute" : "volume")}<span class="inline-volume__track" aria-hidden="true"><span style="transform:scaleX(${vm.volume.level})"></span></span><b>${percentage}</b></span>`;
}

export function compactAccessibleLabel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  const expand = copy.shell.expandAtoll;
  switch (vm.content) {
    case "welcome":
      return `${copy.shell.readyTitle}. ${expand}`;
    case "media": {
      const title = vm.media?.title ?? copy.media.idleTitle;
      const playback = vm.media
        ? vm.media.playing
          ? copy.media.playing
          : copy.media.paused
        : copy.media.waiting;
      return copy.media.accessibleStatus(title, vm.media?.artist ?? null, playback, expand);
    }
    case "volume": {
      const percentage = Math.round(vm.volume.level * 100);
      return `${copy.volume.accessibleValue(percentage, vm.volume.muted)}. ${expand}`;
    }
    default:
      return `Atoll. ${expand}`;
  }
}

export function homeStatusLine(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language).shell;
  if (vm.media?.playing) return copy.mediaPlaying;
  return copy.tagline;
}

export function mediaEmptyCopy(
  mediaConnection: MediaConnection,
  language: UiLanguage,
): { title: string; detail: string } {
  const copy = copyFor(language).media;
  switch (mediaConnection.status) {
    case "checking":
      return {
        title: copy.checkingTitle,
        detail: copy.checkingDetail,
      };
    case "metadata_unavailable":
      return {
        title: copy.metadataTitle,
        detail: copy.metadataDetail,
      };
    case "unavailable":
      return {
        title: copy.unavailableTitle,
        detail: copy.unavailableDetail,
      };
    default:
      return {
        title: copy.idleTitle,
        detail: copy.idleDetail,
      };
  }
}
