import type { AppViewModel } from "../app/types";
import { formatDuration, remainingMs } from "../domain";
import { icon } from "../icons";
import { copyFor } from "../i18n";
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
  const copy = copyFor(vm.settings.language);
  const motionClass = vm.animateContent ? " shell-entering" : "";
  return `
    <section class="atoll-shell expanded expanded--${vm.expandedPanel}${motionClass}" ${shellGeometryStyle("expanded")} aria-label="${copy.shell.quickControls}">
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
      return renderTimerFinishedPanel(vm);
    case "settings":
      return renderSettingsPanel(vm);
    default:
      return renderHomePanel(vm);
  }
}

function renderHomePanel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  const emptyMedia = mediaEmptyCopy(vm.mediaConnection, vm.settings.language);
  return `
    <header class="expanded__header">
      <button class="brand-lockup" type="button" data-action="collapse" aria-label="${copy.shell.collapseAtoll}">
        <span class="mark">${icon("atoll")}</span>
        <span><strong>Atoll</strong><small${vm.timer.phase === "running" ? ' data-timer-remaining data-timer-remaining-copy="remaining"' : ""}>${homeStatusLine(vm)}</small></span>
      </button>
      ${renderInlineVolume(vm)}
      <button class="icon-button" type="button" data-action="open-settings" aria-label="${copy.shell.openSettings}">${icon("gear")}</button>
    </header>
    <div class="home__media ${vm.media ? "" : "is-empty"}">
      ${renderCover(vm.media, "cover cover--home", vm.settings.language)}
      <button class="media-summary" type="button" data-action="open-media" ${vm.media ? "" : "disabled"}>
        <strong>${escapeHtml(vm.media?.title ?? emptyMedia.title)}</strong>
        <small>${escapeHtml(vm.media?.artist ?? emptyMedia.detail)}</small>
      </button>
      ${
        vm.media
          ? `<button class="icon-button icon-button--accent" type="button" data-action="media-toggle" aria-label="${vm.media.playing ? copy.actions.pause : copy.actions.play}" ${vm.media.canPlayPause ? "" : "disabled"} ${vm.pendingMediaCommand !== null ? 'aria-disabled="true"' : ""}>${icon(vm.media.playing ? "pause" : "play")}</button>`
          : ""
      }
    </div>
    <div class="home__timer">
      <span class="section-label">${icon("timer")}<span>${copy.timer.start}</span></span>
      <div class="timer-presets" role="group" aria-label="${copy.timer.presets}">
        ${timerPresetButton(5, vm.settings.language)}
        ${timerPresetButton(10, vm.settings.language)}
        ${timerPresetButton(25, vm.settings.language)}
      </div>
    </div>
    <footer class="expanded__footer">
      <span>Ctrl + Shift + Space</span>
      <button class="text-button" type="button" data-action="hide">${icon("hide")}${copy.shell.hide}</button>
    </footer>`;
}

function renderMediaPanel(vm: AppViewModel): string {
  if (!vm.media) return renderMediaEmptyPanel(vm);
  const copy = copyFor(vm.settings.language);
  const current = vm.media;
  const sourceDetail =
    vm.mediaConnection.sessionCount > 1
      ? `${current.source} · ${copy.media.players(vm.mediaConnection.sessionCount)}`
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
      ${renderCover(current, "cover cover--expanded", vm.settings.language)}
      <button class="media-title" type="button" data-action="collapse" aria-label="${copy.shell.collapseAtoll}" title="${escapeHtml(`${current.title} — ${current.artist}`)}">
        <strong>${escapeHtml(current.title)}</strong>
        <small>${escapeHtml(current.artist)}</small>
      </button>
    </header>
    <div class="media-playback ${hasProgress ? "" : "media-playback--without-progress"}">
      ${renderMediaProgress(current, vm.now, vm.settings.language)}
      <div class="media-controls" role="group" aria-label="${copy.media.controls}" aria-busy="${commandPending}">
        ${mediaButton("media-previous", "previous", copy.actions.previous, current.canPrevious, vm.settings.language, false, commandPending)}
        ${mediaButton("media-toggle", current.playing ? "pause" : "play", current.playing ? copy.actions.pause : copy.actions.play, current.canPlayPause, vm.settings.language, true, commandPending, vm.pendingMediaCommand === "toggle")}
        ${mediaButton("media-next", "next", copy.actions.next, current.canNext, vm.settings.language, false, commandPending)}
      </div>
    </div>
    <footer class="expanded__footer">
      ${footerContent}
    </footer>`;
}

function renderMediaEmptyPanel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  const empty = mediaEmptyCopy(vm.mediaConnection, vm.settings.language);
  return `
    <header class="expanded__header">
      <button class="brand-lockup" type="button" data-action="collapse" aria-label="${copy.shell.collapseAtoll}">
        <span class="mark">${icon("media")}</span>
        <span><strong>Atoll Connect</strong><small>Windows media</small></span>
      </button>
    </header>
    <div class="connect-empty" role="status">
      <strong>${escapeHtml(empty.title)}</strong>
      <small>${escapeHtml(empty.detail)}</small>
    </div>
    <footer class="expanded__footer">
      <span>${vm.mediaConnection.sessionCount > 0 ? copy.media.playerConnected(vm.mediaConnection.sessionCount) : copy.media.supportedPlayers}</span>
      <button class="text-button" type="button" data-action="open-home">${icon("back")}${copy.shell.home}</button>
    </footer>`;
}

function renderTimerPanel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  const time = formatDuration(remainingMs(vm.timer, vm.now));
  return `
    <header class="timer-hero">
      <button class="mark mark--button" type="button" data-action="collapse" aria-label="${copy.shell.collapseAtoll}">${icon("timer")}</button>
      <span class="timer-hero__copy"><small>${vm.timer.phase === "paused" ? copy.timer.focusPaused : copy.timer.focusTimer}</small><time data-timer-remaining>${time}</time></span>
      <span class="timer-hero__status">${vm.timer.phase === "paused" ? copy.timer.paused : copy.timer.running}</span>
    </header>
    <div class="timer-actions">
      <button class="control-button control-button--primary" type="button" data-action="toggle-timer">
        ${icon(vm.timer.phase === "running" ? "pause" : "play")}
        ${vm.timer.phase === "running" ? copy.actions.pause : copy.actions.continue}
      </button>
      <button class="control-button" type="button" data-action="restart-timer">${icon("restart")}${copy.actions.restart}</button>
      <button class="control-button" type="button" data-action="cancel-timer">${icon("close")}${copy.actions.cancel}</button>
    </div>
    <footer class="expanded__footer">
      <span>${copy.timer.accurateTime}</span>
      <button class="text-button" type="button" data-action="open-home">${icon("back")}${copy.shell.home}</button>
    </footer>`;
}

function renderTimerFinishedPanel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  return `
    <header class="timer-finished__hero">
      <span class="finished-mark">${icon("timer")}</span>
      <span><small>${copy.timer.focusTimer}</small><strong>${copy.timer.timesUp}</strong></span>
      <span class="finished-check">${icon("check")}</span>
    </header>
    <p class="timer-finished__message">${copy.timer.completionMessage}</p>
    <div class="timer-actions timer-actions--finished">
      <button class="control-button control-button--primary" type="button" data-action="dismiss-finished">${icon("check")}${copy.actions.stop}</button>
      <button class="control-button" type="button" data-action="restart-timer">${icon("restart")}${copy.actions.restart}</button>
    </div>`;
}

function renderSettingsPanel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  return `
    <header class="expanded__header settings__header">
      <button class="icon-button" type="button" data-action="open-home" aria-label="${copy.shell.backHome}">${icon("back")}</button>
      <span class="settings__title"><strong>${copy.settings.title}</strong><small>${copy.settings.subtitle}</small></span>
      <div class="language-picker segmented" role="group" aria-label="${copy.settings.language}">
        <button type="button" data-action="set-language" data-value="zh-CN" class="${vm.settings.language === "zh-CN" ? "is-active" : ""}" aria-pressed="${vm.settings.language === "zh-CN"}">中文</button>
        <button type="button" data-action="set-language" data-value="en" class="${vm.settings.language === "en" ? "is-active" : ""}" aria-pressed="${vm.settings.language === "en"}">EN</button>
      </div>
    </header>
    <div class="settings__rows">
      ${settingToggle(copy.settings.fullscreen, copy.settings.fullscreenDetail, "hideInFullscreen", vm.settings.hideInFullscreen)}
      <div class="setting-row">
        <span><strong>${copy.settings.idle}</strong><small>${copy.settings.idleDetail}</small></span>
        <div class="segmented" role="group" aria-label="${copy.settings.idle}">
          <button type="button" data-action="set-idle" data-value="reef" class="${vm.settings.idleMode === "reef" ? "is-active" : ""}" aria-pressed="${vm.settings.idleMode === "reef"}">${copy.settings.reef}</button>
          <button type="button" data-action="set-idle" data-value="hidden" class="${vm.settings.idleMode === "hidden" ? "is-active" : ""}" aria-pressed="${vm.settings.idleMode === "hidden"}">${copy.settings.hidden}</button>
        </div>
      </div>
    </div>`;
}
