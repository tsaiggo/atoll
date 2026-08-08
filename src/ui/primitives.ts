import type { AtollSettings } from "../config";
import {
  formatEnergyMeasurement,
  formatPlaybackTime,
  mediaPositionMs,
  type MediaConnection,
  type MediaStatus,
} from "../domain";
import { mediaSeekEnabled } from "../features/media/commands";
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
  pending = false,
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
  const seekEnabled = mediaSeekEnabled(current);
  const track = seekEnabled
    ? `<span class="media-progress__track media-progress__track--seek">
          <input class="media-progress__seek" type="range" min="0" max="${durationSeconds}" step="1" value="${elapsedSeconds}" data-control="media-seek" data-session-revision="${current.sessionRevision}" aria-label="${copy.seek}" aria-valuetext="${copy.progressValue(elapsed, duration)}" aria-busy="${pending}" style="--media-progress:${ratio * 100}%" ${pending ? "disabled" : ""}>
        </span>`
    : `<span class="media-progress__track" role="progressbar" aria-label="${copy.progress}" aria-valuemin="0" aria-valuemax="${durationSeconds}" aria-valuenow="${elapsedSeconds}" aria-valuetext="${copy.progressValue(elapsed, duration)}">
          <span class="media-progress__fill" data-media-progress style="transform:scaleX(${ratio})"></span>
        </span>`;
  return `
    <div class="media-progress">
      ${track}
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

export function renderInlineVolume(vm: AppViewModel, alwaysVisible = false): string {
  if (!alwaysVisible && !vm.showInlineVolume) return "";
  const percentage = Math.round(vm.volume.level * 100);
  const copy = copyFor(vm.settings.language).volume;
  const muteLabel = vm.volume.muted ? copy.unmute : copy.mute;
  return `
    <div class="inline-volume" role="group" aria-label="${copy.controls}">
      <button class="inline-volume__mute" type="button" data-action="toggle-volume-mute" aria-label="${muteLabel}" aria-pressed="${vm.volume.muted}" title="${muteLabel}">${icon(vm.volume.muted ? "volumeMute" : "volume")}</button>
      <input class="inline-volume__range" type="range" min="0" max="100" step="1" value="${percentage}" data-control="system-volume" aria-label="${copy.title}" aria-valuetext="${copy.accessibleValue(percentage, vm.volume.muted)}" style="--volume-level:${percentage}%">
      <output class="inline-volume__value" data-volume-value>${percentage}</output>
    </div>`;
}

export function renderHomeEnergy(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language).energy;
  const available = vm.energy.available;
  const measurement = formatEnergyMeasurement(vm.energy.todayMwh, vm.settings.language);
  const primary = available
    ? copy.todayBatteryDischarge(measurement.value, measurement.unit)
    : copy.capacityUnavailable;
  const trackingSince =
    available && vm.energy.partial && vm.energy.trackingSinceMs > 0
      ? copy.trackingSince(formatEnergyTrackingSince(vm.energy.trackingSinceMs, vm.settings.language))
      : "";
  const detail = available
    ? [vm.energy.partial ? copy.partialRecord : copy.batteryDischargeOnly, trackingSince]
        .filter(Boolean)
        .join(" · ")
    : "";
  return `
    <button class="home__energy-card ${available ? "" : "home__energy-card--unavailable"}" type="button" data-action="open-energy" aria-label="${escapeHtml(`${primary}${detail ? `. ${detail}` : ""}. ${copy.openHistory}`)}">
      <span class="home__energy-copy">
        <strong>${escapeHtml(available ? copy.todayBatteryDischargeTitle : copy.capacityUnavailable)}</strong>
        ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
      </span>
      ${
        available
          ? `<span class="home__energy-value"><strong>${escapeHtml(measurement.value)}</strong><small>${escapeHtml(measurement.unit)}</small></span>`
          : ""
      }
    </button>`;
}

function formatEnergyTrackingSince(timestamp: number, language: UiLanguage): string {
  return new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
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
