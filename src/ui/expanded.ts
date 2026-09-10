import type { AppViewModel } from "../app/types";
import {
  formatCodexResetCountdown,
  formatCodexUsagePercent,
  formatEnergyMeasurement,
  selectCodexUsageWindows,
} from "../domain";
import { icon } from "../icons";
import { copyFor } from "../i18n";
import { escapeHtml } from "./escape";
import {
  mediaButton,
  mediaEmptyCopy,
  renderCover,
  renderHomeEnergy,
  renderMediaProgress,
  settingToggle,
} from "./primitives";

export function renderExpandedShell(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  const motionClass = vm.animateContent ? " shell-entering" : "";
  return `
    <section class="atoll-shell expanded expanded--${vm.expandedPanel}${motionClass}" aria-label="${copy.shell.quickControls}">
      ${renderExpandedPanel(vm)}
    </section>`;
}

function renderExpandedPanel(vm: AppViewModel): string {
  switch (vm.expandedPanel) {
    case "media":
      return renderMediaPanel(vm);
    case "energy":
      return renderEnergyPanel(vm);
    case "codex":
      return renderCodexPanel(vm);
    case "sources":
      return renderSourcePanel(vm);
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
    <div class="home-stack">
      <section class="home-card" aria-label="${copy.shell.quickControls}">
        <header class="expanded__header">
          <button class="brand-lockup" type="button" data-action="collapse" aria-label="${copy.shell.collapseAtoll}">
            <span class="mark">${icon("atoll")}</span>
            <span><strong>Atoll</strong></span>
          </button>
          <button class="icon-button home-card__hide" type="button" data-action="hide" aria-label="${copy.shell.hide}">${icon("hide")}</button>
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
              ? `<button class="icon-button icon-button--transport" type="button" data-action="media-toggle" aria-label="${vm.media.playing ? copy.actions.pause : copy.actions.play}" ${vm.media.canPlayPause ? "" : "disabled"} ${vm.pendingMediaCommand !== null ? 'aria-disabled="true"' : ""}>${icon(vm.media.playing ? "pause" : "play")}</button>`
              : ""
          }
        </div>
      </section>
      ${renderHomeEnergy(vm)}
    </div>`;
}

interface EnergyHistorySlot {
  readonly dayKey: string;
  readonly totalMwh?: number;
  readonly partial: boolean;
  readonly current: boolean;
}

function renderEnergyPanel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  const slots = energyHistorySlots(vm);
  const recordedSlots = slots.filter((slot) => slot.totalMwh !== undefined);
  if (recordedSlots.length === 0) {
    return renderEnergyHistoryEmptyPanel(
      vm,
      vm.energy.available ? copy.energy.historyNoRecord : copy.energy.capacityUnavailable,
      vm.energy.available ? copy.energy.historyFirstDayDetail : copy.energy.historyUnavailableDetail,
    );
  }

  const selected =
    recordedSlots.find((slot) => slot.dayKey === vm.selectedEnergyDayKey) ??
    recordedSlots.find((slot) => slot.current) ??
    recordedSlots.at(-1);
  if (!selected) {
    return renderEnergyHistoryEmptyPanel(vm, copy.energy.historyNoRecord, copy.energy.historyFirstDayDetail);
  }

  const maximumMwh = Math.max(...recordedSlots.map((slot) => slot.totalMwh ?? 0), 1);
  const totalMwh = recordedSlots.reduce((sum, slot) => sum + (slot.totalMwh ?? 0), 0);
  const peakMwh = Math.max(...recordedSlots.map((slot) => slot.totalMwh ?? 0));
  const partialDays = recordedSlots.filter((slot) => slot.partial).length;
  const measured = (value: number) => {
    const result = formatEnergyMeasurement(value, vm.settings.language);
    return `${result.value} ${result.unit}`;
  };
  const metric = (label: string, value: string) => `<div class="energy-stat"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  const selectedDate = selected.current
    ? copy.energy.historyToday
    : formatEnergyHistoryDate(selected.dayKey, vm.settings.language);
  const selectedMeasurement = formatEnergyMeasurement(
    selected.totalMwh ?? 0,
    vm.settings.language,
  );
  return `
    <div class="energy-card" aria-label="${copy.energy.historyTitle}">
      <header class="expanded__header energy-card__header">
        <button class="icon-button" type="button" data-action="open-home" aria-label="${copy.shell.backHome}">${icon("back")}</button>
        <span class="energy-card__title"><strong>${copy.energy.historyTitle}</strong><small>${copy.energy.historySubtitle}</small></span>
      </header>
      <dl class="energy-stats">
        ${metric(copy.energy.historyToday, vm.energy.available ? measured(vm.energy.todayMwh) : "—")}
        ${metric(copy.energy.periodRecorded, measured(totalMwh))}
        ${metric(copy.energy.peakRecorded, measured(peakMwh))}
        ${metric(copy.energy.recordedDays, copy.energy.coverage(recordedSlots.length, partialDays))}
      </dl>
      <div class="energy-history" role="group" aria-label="${copy.energy.historyTitle}">
        ${slots
          .map((slot) => renderEnergyHistorySlot(slot, maximumMwh, selected.dayKey, vm.settings.language))
          .join("")}
      </div>
      <div class="energy-history__axis" aria-hidden="true"><span>${escapeHtml(formatEnergyHistoryDate(slots[0].dayKey, vm.settings.language))}</span><span>${copy.energy.historyToday}</span></div>
      <footer class="energy-history__readout" aria-live="polite">
        <span class="energy-history__selected-copy">
          <strong>${escapeHtml(selectedDate)}</strong>
          ${selected.partial ? `<small>${copy.energy.partialRecord}</small>` : ""}
        </span>
        <span class="energy-history__selected-value"><strong>${escapeHtml(selectedMeasurement.value)}</strong><small>${escapeHtml(selectedMeasurement.unit)}</small></span>
      </footer>
      <p class="energy-history__legend">${copy.energy.historyPartialLegend}<br>${copy.energy.batteryDischargeOnly}</p>
    </div>`;
}

function renderEnergyHistoryEmptyPanel(
  vm: AppViewModel,
  title: string,
  detail: string,
): string {
  const copy = copyFor(vm.settings.language);
  return `
    <div class="energy-card energy-card--empty" aria-label="${copy.energy.historyTitle}">
      <header class="expanded__header energy-card__header">
        <button class="icon-button" type="button" data-action="open-home" aria-label="${copy.shell.backHome}">${icon("back")}</button>
        <span class="energy-card__title"><strong>${copy.energy.historyTitle}</strong><small>${copy.energy.historySubtitle}</small></span>
      </header>
      <div class="energy-history__empty" role="status">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
      <footer class="expanded__footer energy-card__footer">
        <span>${copy.energy.batteryDischargeOnly}</span>
      </footer>
    </div>`;
}

function renderCodexPanel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language).codex;
  const usage = vm.codexUsage;
  const content = renderCodexPanelContent(vm);
  const isEnabled = usage.enabled && usage.status !== "disabled";
  const disablePending = vm.pendingCodexUsageAction === "disable";
  return `
    <div class="codex-card codex-card--${usage.status}" aria-label="${copy.openUsage}">
      <header class="expanded__header codex-card__header">
        <button class="icon-button" type="button" data-action="open-home" aria-label="${copyFor(vm.settings.language).shell.backHome}">${icon("back")}</button>
        <span class="codex-card__title"><strong>${copy.title}</strong><small>${copy.subtitle}</small></span>
      </header>
      ${content}
      <footer class="expanded__footer codex-card__footer">
        <span class="codex-card__privacy" title="${escapeHtml(copy.sourcePrivacy)}">${escapeHtml(copy.sourcePrivacy)}</span>
        ${
          isEnabled
            ? `<button class="text-button codex-card__disable" type="button" data-action="disable-codex-usage" ${disablePending ? "disabled" : ""} aria-busy="${disablePending}">${escapeHtml(disablePending ? copyFor(vm.settings.language).actions.working(copy.disable) : copy.disable)}</button>`
            : ""
        }
      </footer>
    </div>`;
}

function renderCodexPanelContent(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language).codex;
  const usage = vm.codexUsage;
  const pending = vm.pendingCodexUsageAction;
  if (usage.status === "disabled") {
    return renderCodexState(
      copy.enableTitle,
      copy.enableDetail,
      "enable-codex-usage",
      pending === "enable" ? copyFor(vm.settings.language).actions.working(copy.enable) : copy.enable,
      pending === "enable",
    );
  }
  if (usage.status === "checking") {
    return renderCodexState(copy.checkingTitle, copy.checkingDetail);
  }
  if (usage.status === "ready") {
    return renderCodexUsage(vm);
  }

  const failure = codexFailureCopy(usage.status, vm.settings.language);
  const action = usage.enabled ? "refresh-codex-usage" : "enable-codex-usage";
  const actionLabel = usage.enabled
    ? pending === "refresh"
      ? copy.refreshing
      : copy.refresh
    : pending === "enable"
      ? copyFor(vm.settings.language).actions.working(copy.enable)
      : copy.enable;
  return renderCodexState(
    failure.title,
    failure.detail,
    action,
    actionLabel,
    pending === "refresh" || pending === "enable",
  );
}

function renderCodexUsage(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language).codex;
  const selection = selectCodexUsageWindows(vm.codexUsage.windows);
  const primary = selection.primary;
  if (!primary) {
    return renderCodexState(copy.noWindowTitle, copy.noWindowDetail);
  }

  const language = vm.settings.language;
  const rows = [primary, selection.secondary].filter(window => window != null).map(window => {
    const label = window.label || copy.windowFallback(window.windowDurationMins);
    const percent = formatCodexUsagePercent(window.usedPercent, language);
    const used = copy.usagePercent(percent);
    const countdown = formatCodexResetCountdown(window.resetsAtMs, language, vm.now);
    const reset = countdown ? copy.resetIn(countdown) : copy.resetUnknown;
    const color = window.usedPercent < 50 ? "#00FF88" : window.usedPercent < 70 ? "#F2FF00" : "#FF3F00";
    return `<div class="codex-window">
      <div class="codex-window__label"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(reset)}</small></div>
      <span class="codex-usage__meter" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${window.usedPercent}" aria-valuetext="${escapeHtml(used)}"><span style="background:${color};transform:scaleX(${window.usedPercent / 100})"></span></span>
      <small class="codex-window__used" style="color:${color}">${escapeHtml(used)}</small>
    </div>`;
  }).join("");
  return `<div class="codex-usage" role="group" aria-label="${escapeHtml(copy.title)}">${rows}</div>`;
}

function renderCodexState(
  title: string,
  detail: string,
  action?: "enable-codex-usage" | "refresh-codex-usage",
  actionLabel?: string,
  actionPending = false,
): string {
  return `
    <div class="codex-state" role="status">
      <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span>
      ${
        action && actionLabel
          ? `<button class="codex-state__action" type="button" data-action="${action}" ${actionPending ? "disabled" : ""} aria-busy="${actionPending}">${escapeHtml(actionLabel)}</button>`
          : ""
      }
    </div>`;
}

function codexFailureCopy(
  status: Exclude<AppViewModel["codexUsage"]["status"], "disabled" | "checking" | "ready">,
  language: "en" | "zh-CN",
): { title: string; detail: string } {
  const copy = copyFor(language).codex;
  switch (status) {
    case "signed_out":
      return { title: copy.signedOutTitle, detail: copy.signedOutDetail };
    case "unsupported_auth":
      return { title: copy.unsupportedAuthTitle, detail: copy.unsupportedAuthDetail };
    case "cli_missing":
      return { title: copy.cliMissingTitle, detail: copy.cliMissingDetail };
    case "protocol_error":
      return { title: copy.protocolErrorTitle, detail: copy.protocolErrorDetail };
    case "unavailable":
      return { title: copy.unavailableTitle, detail: copy.unavailableDetail };
  }
}

function energyHistorySlots(vm: AppViewModel): EnergyHistorySlot[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vm.energy.dayKey)) return [];
  const historyByDay = new Map(vm.energy.history.map((entry) => [entry.dayKey, entry]));
  return Array.from({ length: 30 }, (_, index) => {
    const dayKey = offsetEnergyDay(vm.energy.dayKey, index - 29);
    const current = index === 29;
    if (current) {
      return {
        dayKey,
        totalMwh: vm.energy.available ? vm.energy.todayMwh : undefined,
        partial: vm.energy.partial,
        current: true,
      };
    }
    const entry = historyByDay.get(dayKey);
    return {
      dayKey,
      totalMwh: entry?.totalMwh,
      partial: entry?.partial === true,
      current: false,
    };
  });
}

function renderEnergyHistorySlot(
  slot: EnergyHistorySlot,
  maximumMwh: number,
  selectedDayKey: string | null,
  language: "en" | "zh-CN",
): string {
  const copy = copyFor(language).energy;
  const date = formatEnergyHistoryDate(slot.dayKey, language);
  if (slot.totalMwh === undefined) {
    return `
      <button class="energy-history__day energy-history__day--empty" type="button" disabled title="${escapeHtml(copy.historyMissingEntry(date))}" aria-label="${escapeHtml(copy.historyMissingEntry(date))}">
        <span class="energy-history__bar-area" aria-hidden="true"></span>
        <span class="sr-only">${escapeHtml(copy.historyMissingEntry(date))}</span>
      </button>`;
  }

  const measurement = formatEnergyMeasurement(slot.totalMwh, language);
  const percentage = (slot.totalMwh / maximumMwh) * 100;
  const label = copy.historyEntry(date, measurement.value, measurement.unit, slot.partial);
  return `
    <button class="energy-history__day ${selectedDayKey === slot.dayKey ? "is-selected" : ""}" type="button" data-action="select-energy-day" data-value="${slot.dayKey}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" aria-pressed="${selectedDayKey === slot.dayKey}">
      <span class="energy-history__bar-area" aria-hidden="true"><span class="energy-history__bar ${slot.partial ? "energy-history__bar--partial" : ""}" style="--energy-bar:${percentage}%"></span></span>
    </button>`;
}

function offsetEnergyDay(dayKey: string, offset: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatEnergyHistoryDate(dayKey: string, language: "en" | "zh-CN"): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function renderMediaPanel(vm: AppViewModel): string {
  if (!vm.media) return renderMediaEmptyPanel(vm);
  const copy = copyFor(vm.settings.language);
  const current = vm.media;
  const sourceDetail = sourceDetailFor(vm, current.source);
  const hasProgress =
    current.positionMs !== undefined &&
    current.durationMs !== undefined &&
    current.durationMs > 0;
  const commandPending = vm.pendingMediaCommand !== null;
  const sourceCopy = vm.mediaCommandFeedback?.message ?? sourceDetail;
  const canChooseSource =
    !vm.mediaCommandFeedback &&
    !vm.pendingMediaSeek &&
    vm.mediaConnection.sources.length > 1;
  const footerContent =
    canChooseSource
        ? renderSourceTrigger(vm, sourceCopy)
      : `<span class="source-label ${vm.mediaCommandFeedback?.failed ? "source-label--feedback" : ""}" aria-live="${vm.mediaCommandFeedback ? "polite" : "off"}"><span class="source-label__dot" aria-hidden="true"></span><span>${escapeHtml(sourceCopy)}</span></span>`;
  return `
    <div class="media-card">
      <header class="expanded__header expanded__header--media">
        ${renderCover(current, "cover cover--expanded", vm.settings.language)}
        <button class="media-title" type="button" data-action="collapse" aria-label="${copy.shell.collapseAtoll}" title="${escapeHtml(`${current.title} — ${current.artist}`)}">
          <strong>${escapeHtml(current.title)}</strong>
          <small>${escapeHtml(current.artist)}</small>
        </button>
        <button class="icon-button icon-button--media-settings" type="button" data-action="open-settings" aria-label="${copy.shell.openSettings}">${icon("gear")}</button>
      </header>
      <div class="media-playback ${hasProgress ? "" : "media-playback--without-progress"}">
        ${renderMediaProgress(current, vm.now, vm.settings.language, vm.pendingMediaSeek || commandPending)}
        <div class="media-controls" role="group" aria-label="${copy.media.controls}" aria-busy="${commandPending}">
          ${mediaButton("media-previous", "previous", copy.actions.previous, current.canPrevious, vm.settings.language, false, commandPending)}
          ${mediaButton("media-toggle", current.playing ? "pause" : "play", current.playing ? copy.actions.pause : copy.actions.play, current.canPlayPause, vm.settings.language, true, commandPending, vm.pendingMediaCommand === "toggle")}
          ${mediaButton("media-next", "next", copy.actions.next, current.canNext, vm.settings.language, false, commandPending)}
        </div>
      </div>
      <footer class="expanded__footer">
        ${footerContent}
        <button class="text-button" type="button" data-action="open-home" aria-label="${copy.shell.backHome}">${icon("back")}${copy.shell.home}</button>
      </footer>
    </div>`;
}

function renderSourceTrigger(vm: AppViewModel, sourceCopy: string): string {
  const copy = copyFor(vm.settings.language);
  return `
    <button class="source-trigger" type="button" data-action="open-sources" aria-label="${copy.media.chooseSource}" ${vm.pendingSourceSelection || vm.pendingMediaSeek ? "disabled" : ""} aria-busy="${vm.pendingSourceSelection || vm.pendingMediaSeek}">
      <span class="source-label"><span class="source-label__dot" aria-hidden="true"></span><span>${escapeHtml(sourceCopy)}</span></span>
      ${icon("chevronRight")}
    </button>`;
}

function renderSourcePanel(vm: AppViewModel): string {
  if (vm.mediaConnection.sources.length < 2) {
    return vm.media ? renderMediaPanel(vm) : renderMediaEmptyPanel(vm);
  }
  const copy = copyFor(vm.settings.language);
  const selected = vm.mediaConnection.manualSource;
  const automaticSelected = selected === null;
  return `
    <div class="source-card">
      <header class="expanded__header source-card__header">
        <button class="icon-button" type="button" data-action="open-media" aria-label="${copy.media.backToControls}">${icon("back")}</button>
        <span class="source-card__title"><strong>${copy.media.sourceTitle}</strong></span>
      </header>
      <div class="source-list" role="radiogroup" aria-label="${copy.media.chooseSource}" aria-busy="${vm.pendingSourceSelection}">
        ${renderSourceOption(copy.media.sourceAutomatic, "auto", automaticSelected, vm.pendingSourceSelection)}
        ${vm.mediaConnection.sources
          .map((source, index) =>
            renderSourceOption(
              source.label,
              String(index),
              selected?.providerId === source.providerId && selected.sourceId === source.sourceId,
              vm.pendingSourceSelection,
            ),
          )
          .join("")}
      </div>
    </div>`;
}

function renderSourceOption(
  label: string,
  value: string,
  checked: boolean,
  pending: boolean,
): string {
  return `
    <button class="source-option" type="button" role="radio" aria-checked="${checked}" data-action="select-media-source" data-value="${value}" ${pending ? "disabled" : ""}>
      <span>${escapeHtml(label)}</span>
      <span class="source-option__selection" aria-hidden="true"></span>
    </button>`;
}

function renderMediaEmptyPanel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  const empty = mediaEmptyCopy(vm.mediaConnection, vm.settings.language);
  const sourceFooter =
    vm.mediaConnection.sources.length > 1
      ? renderSourceTrigger(vm, sourceDetailFor(vm))
      : `<span>${vm.mediaConnection.sessionCount > 0 ? copy.media.playerConnected(vm.mediaConnection.sessionCount) : copy.media.supportedPlayers}</span>`;
  return `
    <div class="media-card media-card--empty">
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
        ${sourceFooter}
        <button class="text-button" type="button" data-action="open-home">${icon("back")}${copy.shell.home}</button>
      </footer>
    </div>`;
}

function sourceDetailFor(vm: AppViewModel, fallbackSource?: string): string {
  const copy = copyFor(vm.settings.language);
  const manual = vm.mediaConnection.manualSource;
  if (manual) {
    const selected = vm.mediaConnection.sources.find(
      (source) =>
        source.providerId === manual.providerId && source.sourceId === manual.sourceId,
    );
    return `${selected?.label ?? fallbackSource ?? copy.media.sourceAutomatic} · ${copy.media.sourcePinned}`;
  }
  if (fallbackSource) {
    return vm.mediaConnection.sessionCount > 1
      ? `${fallbackSource} · ${copy.media.players(vm.mediaConnection.sessionCount)}`
      : fallbackSource;
  }
  return `${copy.media.sourceAutomatic} · ${copy.media.players(vm.mediaConnection.sessionCount)}`;
}

function renderSettingsPanel(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  return `
    <div class="settings-card">
      <header class="expanded__header settings__header">
        <button class="icon-button" type="button" data-action="open-home" aria-label="${copy.shell.backHome}">${icon("back")}</button>
        <span class="settings__title"><strong>${copy.settings.title}</strong><small>${copy.settings.subtitle}</small></span>
        <div class="language-picker segmented" role="group" aria-label="${copy.settings.language}">
          <button type="button" data-action="set-language" data-value="zh-CN" class="${vm.settings.language === "zh-CN" ? "is-active" : ""}" aria-pressed="${vm.settings.language === "zh-CN"}">中文</button>
          <button type="button" data-action="set-language" data-value="en" class="${vm.settings.language === "en" ? "is-active" : ""}" aria-pressed="${vm.settings.language === "en"}">EN</button>
        </div>
      </header>
      <div class="settings__rows">
        <div class="setting-row setting-row--options">
          <strong>${copy.notch.placement}</strong>
          <div class="setting-options setting-options--edges" role="group" aria-label="${copy.notch.placement}">
            ${(["top", "bottom", "left", "right"] as const).map((edge) => `<button class="setting-option" type="button" data-action="set-notch-edge" data-value="${edge}" aria-pressed="${vm.settings.notchEdge === edge}">${copy.notch.edges[edge]}</button>`).join("")}
          </div>
        </div>
        <div class="setting-row setting-row--options">
          <strong>${copy.notch.visibility}</strong>
          <div class="setting-options" role="group" aria-label="${copy.notch.visibility}">
            <button class="setting-option" type="button" data-action="set-notch-visibility" data-value="auto" aria-pressed="${vm.settings.notchVisibility === "auto"}">${copy.notch.automatic}</button>
            <button class="setting-option" type="button" data-action="set-notch-visibility" data-value="always" aria-pressed="${vm.settings.notchVisibility === "always"}">${copy.notch.always}</button>
          </div>
        </div>
        ${settingToggle(copy.settings.fullscreen, copy.settings.fullscreenDetail, "hideInFullscreen", vm.settings.hideInFullscreen)}
      </div>
      <p class="settings__hint">${copy.notch.hint}</p>
    </div>`;
}
