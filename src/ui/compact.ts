import type { AppViewModel } from "../app/types";
import { formatDuration, remainingMs } from "../domain";
import { icon } from "../icons";
import { shellGeometryStyle } from "../shell/geometry";
import { escapeHtml } from "./escape";
import { compactAccessibleLabel, renderCover } from "./primitives";

export function renderCompactShell(vm: AppViewModel): string {
  const motionClass = vm.animateContent ? " shell-entering" : "";
  if (vm.content === "media" && vm.media) {
    return renderCompactMedia(vm, motionClass);
  }
  return `
    <button class="atoll-shell compact compact--${vm.content}${motionClass}" ${shellGeometryStyle("compact")} type="button" aria-label="${escapeHtml(compactAccessibleLabel(vm))}">
      ${renderCompactContent(vm)}
    </button>`;
}

function renderCompactMedia(vm: AppViewModel, motionClass: string): string {
  if (!vm.media) return "";
  const current = vm.media;
  const commandPending = vm.pendingMediaCommand !== null;
  const toggleLabel = current.playing ? "Pause" : "Play";
  return `
    <div class="atoll-shell compact compact--media${motionClass}" ${shellGeometryStyle("compact")} role="group" aria-label="Current media controls">
      <button class="compact-media__open" type="button" data-action="open-media" aria-label="Open media controls for ${escapeHtml(current.title)}">
        ${renderCover(current, "cover cover--compact")}
        <span class="compact__copy" title="${escapeHtml(`${current.title} — ${current.artist}`)}">
          <strong>${escapeHtml(current.title)}</strong>
          <small>${escapeHtml(current.artist)}</small>
        </span>
      </button>
      <button class="compact-media__toggle ${vm.pendingMediaCommand === "toggle" ? "is-pending" : ""}" type="button" data-action="media-toggle" aria-label="${toggleLabel}" aria-pressed="${current.playing}" aria-busy="${vm.pendingMediaCommand === "toggle"}" ${!current.canPlayPause ? "disabled" : ""} ${commandPending ? 'aria-disabled="true"' : ""}>
        ${icon(current.playing ? "pause" : "play")}
      </button>
      <span class="sr-only" role="status" aria-live="polite">${escapeHtml(vm.mediaCommandFeedback?.message ?? "")}</span>
    </div>`;
}

function renderCompactContent(vm: AppViewModel): string {
  switch (vm.content) {
    case "welcome":
      return `
        <span class="mark mark--compact">${icon("atoll")}</span>
        <span class="compact__copy">
          <strong>Atoll is ready</strong>
          <small>Click to surface controls</small>
        </span>`;
    case "media":
      return `
        ${renderCover(vm.media, "cover cover--compact")}
        <span class="compact__copy">
          <strong>${escapeHtml(vm.media?.title ?? "No media")}</strong>
          <small>${escapeHtml(vm.media?.artist ?? "Waiting for a session")}</small>
        </span>
        <span class="compact__status">${icon(vm.media?.playing ? "pause" : "play")}</span>`;
    case "volume": {
      const percentage = Math.round(vm.volume.level * 100);
      return `
        <span class="compact__glyph">${icon(vm.volume.muted ? "volumeMute" : "volume")}</span>
        <span class="volume__stack">
          <span class="volume__label">${vm.volume.muted ? "Muted" : "Volume"} <strong>${percentage}%</strong></span>
          <span class="meter" role="meter" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" aria-valuetext="${vm.volume.muted ? `Muted, ${percentage} percent` : `${percentage} percent`}"><span style="transform:scaleX(${vm.volume.level})"></span></span>
        </span>`;
    }
    case "timer":
      return `
        <span class="compact__glyph compact__glyph--timer">${icon("timer")}</span>
        <span class="compact__copy">
          <strong>Focus</strong>
          <small>${vm.timer.phase === "paused" ? "Paused" : "In progress"}</small>
        </span>
        <time class="compact__time">${formatDuration(remainingMs(vm.timer, vm.now))}</time>`;
    case "timer-finished":
      return `
        <span class="compact__glyph compact__glyph--finished">${icon("timer")}</span>
        <span class="compact__copy">
          <strong>Time’s up</strong>
          <small>Focus session complete</small>
        </span>
        <span class="compact__status compact__status--finished">${icon("check")}</span>`;
    default:
      return `
        <span class="mark mark--compact">${icon("atoll")}</span>
        <span class="compact__copy"><strong>Atoll</strong><small>Your status, surfaced.</small></span>`;
  }
}
