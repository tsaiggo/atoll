import type { AppViewModel } from "../app/types";
import { formatDuration, remainingMs } from "../domain";
import { icon } from "../icons";
import { shellGeometryStyle } from "../shell/geometry";
import { escapeHtml } from "./escape";
import {
  homeStatusLine,
  mediaButton,
  mediaEmptyCopy,
  renderCover,
  renderInlineVolume,
  renderMediaProgress,
  settingToggle,
  timerPresetButton,
} from "./primitives";

export function renderExpandedShell(vm: AppViewModel): string {
  const motionClass = vm.animateContent ? " shell-entering" : "";
  return `
    <section class="atoll-shell expanded expanded--${vm.expandedPanel}${motionClass}" ${shellGeometryStyle("expanded")} aria-label="Atoll quick controls">
      ${renderExpandedPanel(vm)}
    </section>`;
}

function renderExpandedPanel(vm: AppViewModel): string {
  switch (vm.expandedPanel) {
    case "media":
      return renderMediaPanel(vm);
    case "timer":
      return renderTimerPanel(vm);
    case "timer-finished":
      return renderTimerFinishedPanel();
    case "settings":
      return renderSettingsPanel(vm);
    default:
      return renderHomePanel(vm);
  }
}

function renderHomePanel(vm: AppViewModel): string {
  const emptyMedia = mediaEmptyCopy(vm.mediaConnection);
  return `
    <header class="expanded__header">
      <button class="brand-lockup" type="button" data-action="collapse" aria-label="Collapse Atoll">
        <span class="mark">${icon("atoll")}</span>
        <span><strong>Atoll</strong><small${vm.timer.phase === "running" ? ' data-timer-remaining data-timer-remaining-suffix=" remaining"' : ""}>${homeStatusLine(vm)}</small></span>
      </button>
      ${renderInlineVolume(vm)}
      <button class="icon-button" type="button" data-action="open-settings" aria-label="Open settings">${icon("gear")}</button>
    </header>
    <div class="home__media ${vm.media ? "" : "is-empty"}">
      ${renderCover(vm.media, "cover cover--home")}
      <button class="media-summary" type="button" data-action="open-media" ${vm.media ? "" : "disabled"}>
        <strong>${escapeHtml(vm.media?.title ?? emptyMedia.title)}</strong>
        <small>${escapeHtml(vm.media?.artist ?? emptyMedia.detail)}</small>
      </button>
      ${
        vm.media
          ? `<button class="icon-button icon-button--accent" type="button" data-action="media-toggle" aria-label="${vm.media.playing ? "Pause" : "Play"}" ${vm.media.canPlayPause ? "" : "disabled"} ${vm.pendingMediaCommand !== null ? 'aria-disabled="true"' : ""}>${icon(vm.media.playing ? "pause" : "play")}</button>`
          : ""
      }
    </div>
    <div class="home__timer">
      <span class="section-label">${icon("timer")}<span>Start a focus timer</span></span>
      <div class="timer-presets" role="group" aria-label="Timer presets">
        ${timerPresetButton(5)}
        ${timerPresetButton(10)}
        ${timerPresetButton(25)}
      </div>
    </div>
    <footer class="expanded__footer">
      <span>Ctrl + Shift + Space</span>
      <button class="text-button" type="button" data-action="hide">${icon("hide")}Hide</button>
    </footer>`;
}

function renderMediaPanel(vm: AppViewModel): string {
  if (!vm.media) return renderMediaEmptyPanel(vm);
  const current = vm.media;
  const sourceDetail =
    vm.mediaConnection.sessionCount > 1
      ? `${current.source} · ${vm.mediaConnection.sessionCount} players`
      : current.source;
  const hasProgress =
    current.positionMs !== undefined &&
    current.durationMs !== undefined &&
    current.durationMs > 0;
  const commandPending = vm.pendingMediaCommand !== null;
  const sourceCopy = vm.mediaCommandFeedback?.message ?? sourceDetail;
  const footerContent =
    !vm.mediaCommandFeedback && vm.showInlineVolume
      ? renderInlineVolume(vm)
      : `<span class="source-label ${vm.mediaCommandFeedback?.failed ? "source-label--feedback" : ""}" aria-live="${vm.mediaCommandFeedback ? "polite" : "off"}"><span class="source-label__dot" aria-hidden="true"></span><span>${escapeHtml(sourceCopy)}</span></span>`;
  return `
    <header class="expanded__header expanded__header--media">
      ${renderCover(current, "cover cover--expanded")}
      <button class="media-title" type="button" data-action="collapse" aria-label="Collapse Atoll" title="${escapeHtml(`${current.title} — ${current.artist}`)}">
        <strong>${escapeHtml(current.title)}</strong>
        <small>${escapeHtml(current.artist)}</small>
      </button>
      <button class="icon-button" type="button" data-action="open-settings" aria-label="Open settings">${icon("gear")}</button>
    </header>
    <div class="media-playback ${hasProgress ? "" : "media-playback--without-progress"}">
      ${renderMediaProgress(current, vm.now)}
      <div class="media-controls" role="group" aria-label="Media controls" aria-busy="${commandPending}">
        ${mediaButton("media-previous", "previous", "Previous", current.canPrevious, false, commandPending)}
        ${mediaButton("media-toggle", current.playing ? "pause" : "play", current.playing ? "Pause" : "Play", current.canPlayPause, true, commandPending, vm.pendingMediaCommand === "toggle")}
        ${mediaButton("media-next", "next", "Next", current.canNext, false, commandPending)}
      </div>
    </div>
    <footer class="expanded__footer">
      ${footerContent}
    </footer>`;
}

function renderMediaEmptyPanel(vm: AppViewModel): string {
  const empty = mediaEmptyCopy(vm.mediaConnection);
  return `
    <header class="expanded__header">
      <button class="brand-lockup" type="button" data-action="collapse" aria-label="Collapse Atoll">
        <span class="mark">${icon("media")}</span>
        <span><strong>Atoll Connect</strong><small>Windows media</small></span>
      </button>
      <button class="icon-button" type="button" data-action="open-settings" aria-label="Open settings">${icon("gear")}</button>
    </header>
    <div class="connect-empty" role="status">
      <strong>${escapeHtml(empty.title)}</strong>
      <small>${escapeHtml(empty.detail)}</small>
    </div>
    <footer class="expanded__footer">
      <span>${vm.mediaConnection.sessionCount > 0 ? `${vm.mediaConnection.sessionCount} player connected` : "QQ Music · Spotify · browsers"}</span>
      <button class="text-button" type="button" data-action="open-home">${icon("back")}Home</button>
    </footer>`;
}

function renderTimerPanel(vm: AppViewModel): string {
  const time = formatDuration(remainingMs(vm.timer, vm.now));
  return `
    <header class="timer-hero">
      <button class="mark mark--button" type="button" data-action="collapse" aria-label="Collapse Atoll">${icon("timer")}</button>
      <span class="timer-hero__copy"><small>${vm.timer.phase === "paused" ? "Focus paused" : "Focus timer"}</small><time data-timer-remaining>${time}</time></span>
      <span class="timer-hero__status">${vm.timer.phase === "paused" ? "Paused" : "Running"}</span>
    </header>
    <div class="timer-actions">
      <button class="control-button control-button--primary" type="button" data-action="toggle-timer">
        ${icon(vm.timer.phase === "running" ? "pause" : "play")}
        ${vm.timer.phase === "running" ? "Pause" : "Continue"}
      </button>
      <button class="control-button" type="button" data-action="restart-timer">${icon("restart")}Restart</button>
      <button class="control-button" type="button" data-action="cancel-timer">${icon("close")}Cancel</button>
    </div>
    <footer class="expanded__footer">
      <span>Ends from real elapsed time</span>
      <button class="text-button" type="button" data-action="open-home">${icon("back")}Home</button>
    </footer>`;
}

function renderTimerFinishedPanel(): string {
  return `
    <header class="timer-finished__hero">
      <span class="finished-mark">${icon("timer")}</span>
      <span><small>Focus timer</small><strong>Time’s up</strong></span>
      <span class="finished-check">${icon("check")}</span>
    </header>
    <p class="timer-finished__message">Your session is complete. Take a breath before the next one.</p>
    <div class="timer-actions timer-actions--finished">
      <button class="control-button control-button--primary" type="button" data-action="dismiss-finished">${icon("check")}Stop</button>
      <button class="control-button" type="button" data-action="restart-timer">${icon("restart")}Restart</button>
    </div>`;
}

function renderSettingsPanel(vm: AppViewModel): string {
  return `
    <header class="expanded__header settings__header">
      <button class="icon-button" type="button" data-action="open-home" aria-label="Back to Atoll home">${icon("back")}</button>
      <span class="settings__title"><strong>Settings</strong><small>Changes apply immediately</small></span>
      <button class="text-button" type="button" data-action="reset-settings">Reset</button>
    </header>
    <div class="settings__rows">
      ${settingToggle("Motion", "Smooth state changes", "animationsEnabled", vm.settings.animationsEnabled)}
      ${settingToggle("Full screen", "Hide Atoll automatically", "hideInFullscreen", vm.settings.hideInFullscreen)}
      <div class="setting-row">
        <span><strong>Idle</strong><small>When nothing needs attention</small></span>
        <div class="segmented" role="group" aria-label="Idle behavior">
          <button type="button" data-action="set-idle" data-value="reef" class="${vm.settings.idleMode === "reef" ? "is-active" : ""}" aria-pressed="${vm.settings.idleMode === "reef"}">Reef</button>
          <button type="button" data-action="set-idle" data-value="hidden" class="${vm.settings.idleMode === "hidden" ? "is-active" : ""}" aria-pressed="${vm.settings.idleMode === "hidden"}">Hidden</button>
        </div>
      </div>
    </div>`;
}
