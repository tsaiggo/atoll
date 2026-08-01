import type { AppViewModel } from "../app/types";
import type { CarouselCardKind } from "../features/surface/carousel";
import { formatDuration, remainingMs } from "../domain";
import { icon } from "../icons";
import { copyFor } from "../i18n";
import { shellGeometryStyle } from "../shell/geometry";
import { escapeHtml } from "./escape";
import { compactAccessibleLabel, renderCover } from "./primitives";

export function renderCompactShell(vm: AppViewModel): string {
  const carousel = compactCarouselPresentation(vm);
  const motionClass = [
    vm.animateContent ? "shell-entering" : "",
    vm.carouselMotion ? `carousel-${vm.carouselMotion}` : "",
  ]
    .filter(Boolean)
    .map((className) => ` ${className}`)
    .join("");
  if (vm.content === "media" && vm.media) {
    return renderCompactMedia(vm, motionClass, carousel);
  }
  return `
    <button class="atoll-shell compact compact--${vm.content}${carousel.className}${motionClass}" ${shellGeometryStyle("compact")} ${carousel.attribute} ${vm.content === "timer" ? `data-timer-aria-suffix="${escapeHtml(carousel.labelSuffix)}"` : ""} type="button" aria-label="${escapeHtml(`${compactAccessibleLabel(vm)}${carousel.labelSuffix}`)}">
      ${renderCompactContent(vm)}
      ${carousel.indicator}
    </button>`;
}

function renderCompactMedia(
  vm: AppViewModel,
  motionClass: string,
  carousel: CompactCarouselPresentation,
): string {
  if (!vm.media) return "";
  const copy = copyFor(vm.settings.language);
  const current = vm.media;
  const commandPending = vm.pendingMediaCommand !== null;
  const toggleLabel = current.playing ? copy.actions.pause : copy.actions.play;
  return `
    <div class="atoll-shell compact compact--media${carousel.className}${motionClass}" ${shellGeometryStyle("compact")} ${carousel.attribute} role="group" aria-label="${escapeHtml(`${copy.media.currentControls}${carousel.labelSuffix}`)}">
      <button class="compact-media__open" type="button" data-action="open-media" aria-label="${escapeHtml(copy.media.openControlsFor(current.title))}">
        ${renderCover(current, "cover cover--compact", vm.settings.language)}
        <span class="compact__copy" title="${escapeHtml(`${current.title} — ${current.artist}`)}">
          <strong>${escapeHtml(current.title)}</strong>
          <small>${escapeHtml(current.artist)}</small>
        </span>
      </button>
      <button class="compact-media__toggle ${vm.pendingMediaCommand === "toggle" ? "is-pending" : ""}" type="button" data-action="media-toggle" aria-label="${toggleLabel}" aria-pressed="${current.playing}" aria-busy="${vm.pendingMediaCommand === "toggle"}" ${!current.canPlayPause ? "disabled" : ""} ${commandPending ? 'aria-disabled="true"' : ""}>
        ${icon(current.playing ? "pause" : "play")}
      </button>
      <span class="sr-only" role="status" aria-live="polite">${escapeHtml(vm.mediaCommandFeedback?.message ?? "")}</span>
      ${carousel.indicator}
    </div>`;
}

interface CompactCarouselPresentation {
  className: string;
  attribute: string;
  labelSuffix: string;
  indicator: string;
}

function compactCarouselPresentation(vm: AppViewModel): CompactCarouselPresentation {
  const card = carouselCardForContent(vm.content);
  const index = card ? vm.carouselCards.indexOf(card) : -1;
  if (vm.carouselCards.length < 2 || index < 0) {
    return { className: "", attribute: "", labelSuffix: "", indicator: "" };
  }

  const position = index + 1;
  const indicator = vm.carouselCards
    .map(
      (candidate) =>
        `<span class="compact-carousel__dot${candidate === card ? " is-active" : ""}"></span>`,
    )
    .join("");
  return {
    className: " has-carousel",
    attribute: 'data-carousel="true"',
    labelSuffix: copyFor(vm.settings.language).carousel.position(
      position,
      vm.carouselCards.length,
    ),
    indicator: `<span class="compact-carousel__position" aria-hidden="true">${indicator}</span>`,
  };
}

function carouselCardForContent(content: AppViewModel["content"]): CarouselCardKind | null {
  return content === "media" || content === "timer" ? content : null;
}

function renderCompactContent(vm: AppViewModel): string {
  const copy = copyFor(vm.settings.language);
  switch (vm.content) {
    case "welcome":
      return `
        <span class="mark mark--compact">${icon("atoll")}</span>
        <span class="compact__copy">
          <strong>${copy.shell.readyTitle}</strong>
          <small>${copy.shell.readyDetail}</small>
        </span>`;
    case "media":
      return `
        ${renderCover(vm.media, "cover cover--compact", vm.settings.language)}
        <span class="compact__copy">
          <strong>${escapeHtml(vm.media?.title ?? copy.media.noMedia)}</strong>
          <small>${escapeHtml(vm.media?.artist ?? copy.media.waitingForSession)}</small>
        </span>
        <span class="compact__status">${icon(vm.media?.playing ? "pause" : "play")}</span>`;
    case "volume": {
      const percentage = Math.round(vm.volume.level * 100);
      return `
        <span class="compact__glyph">${icon(vm.volume.muted ? "volumeMute" : "volume")}</span>
        <span class="volume__stack">
          <span class="volume__label">${vm.volume.muted ? copy.volume.muted : copy.volume.title} <strong>${percentage}%</strong></span>
          <span class="meter" role="meter" aria-label="${copy.volume.title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" aria-valuetext="${copy.volume.accessibleValue(percentage, vm.volume.muted)}"><span style="transform:scaleX(${vm.volume.level})"></span></span>
        </span>`;
    }
    case "timer":
      return `
        <span class="compact__glyph compact__glyph--timer">${icon("timer")}</span>
        <span class="compact__copy">
          <strong>${copy.timer.focus}</strong>
          <small>${vm.timer.phase === "paused" ? copy.timer.paused : copy.timer.inProgress}</small>
        </span>
        <time class="compact__time" data-timer-remaining>${formatDuration(remainingMs(vm.timer, vm.now))}</time>`;
    case "timer-finished":
      return `
        <span class="compact__glyph compact__glyph--finished">${icon("timer")}</span>
        <span class="compact__copy">
          <strong>${copy.timer.timesUp}</strong>
          <small>${copy.timer.complete}</small>
        </span>
        <span class="compact__status compact__status--finished">${icon("check")}</span>`;
    default:
      return `
        <span class="mark mark--compact">${icon("atoll")}</span>
        <span class="compact__copy"><strong>Atoll</strong><small>${copy.shell.tagline}</small></span>`;
  }
}
