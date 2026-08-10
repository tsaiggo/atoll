import type { AppViewModel } from "../app/types";
import { formatEnergyMeasurement } from "../domain";
import { icon } from "../icons";
import { copyFor } from "../i18n";
import { shellGeometryStyle } from "../shell/geometry";
import { escapeHtml } from "./escape";
import {
  mediaButton,
  mediaEmptyCopy,
  renderCover,
  renderHomeEnergy,
  renderInlineVolume,
  renderMediaProgress,
  settingToggle,
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
    case "energy":
      return renderEnergyPanel(vm);
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
          ${renderInlineVolume(vm, true)}
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
  const historySubtitle = recordedSlots.some((slot) => slot.partial)
    ? `${copy.energy.historySubtitle} · ${copy.energy.historyPartialLegend}`
    : copy.energy.historySubtitle;
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
        <span class="energy-card__title"><strong>${copy.energy.historyTitle}</strong><small>${escapeHtml(historySubtitle)}</small></span>
      </header>
      <div class="energy-history" role="group" aria-label="${copy.energy.historyTitle}">
        ${slots
          .map((slot) => renderEnergyHistorySlot(slot, maximumMwh, vm.selectedEnergyDayKey, vm.settings.language))
          .join("")}
      </div>
      <footer class="energy-history__readout" aria-live="polite">
        <span class="energy-history__selected-copy">
          <strong>${escapeHtml(selectedDate)}</strong>
          ${selected.partial ? `<small>${copy.energy.partialRecord}</small>` : ""}
        </span>
        <span class="energy-history__selected-value"><strong>${escapeHtml(selectedMeasurement.value)}</strong><small>${escapeHtml(selectedMeasurement.unit)}</small></span>
      </footer>
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

function energyHistorySlots(vm: AppViewModel): EnergyHistorySlot[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vm.energy.dayKey)) return [];
  const historyByDay = new Map(vm.energy.history.map((entry) => [entry.dayKey, entry]));
  return Array.from({ length: 7 }, (_, index) => {
    const dayKey = offsetEnergyDay(vm.energy.dayKey, index - 6);
    const current = index === 6;
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
      <button class="energy-history__day energy-history__day--empty" type="button" disabled aria-label="${escapeHtml(copy.historyMissingEntry(date))}">
        <span class="energy-history__bar-area" aria-hidden="true"></span>
        <small>${escapeHtml(date)}</small>
        <span class="sr-only">${escapeHtml(copy.historyMissingEntry(date))}</span>
      </button>`;
  }

  const measurement = formatEnergyMeasurement(slot.totalMwh, language);
  const percentage = Math.max(3, Math.round((slot.totalMwh / maximumMwh) * 100));
  const label = copy.historyEntry(date, measurement.value, measurement.unit, slot.partial);
  return `
    <button class="energy-history__day ${selectedDayKey === slot.dayKey ? "is-selected" : ""}" type="button" data-action="select-energy-day" data-value="${slot.dayKey}" aria-label="${escapeHtml(label)}" aria-pressed="${selectedDayKey === slot.dayKey}">
      <span class="energy-history__bar-area" aria-hidden="true"><span class="energy-history__bar ${slot.partial ? "energy-history__bar--partial" : ""}" style="--energy-bar:${percentage}%"></span></span>
      <small>${escapeHtml(date)}</small>
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
    !vm.showInlineVolume &&
    !vm.pendingMediaSeek &&
    vm.mediaConnection.sources.length > 1;
  const footerContent =
    !vm.mediaCommandFeedback && vm.showInlineVolume
      ? renderInlineVolume(vm)
      : canChooseSource
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
        ${settingToggle(copy.settings.fullscreen, copy.settings.fullscreenDetail, "hideInFullscreen", vm.settings.hideInFullscreen)}
      </div>
    </div>`;
}
