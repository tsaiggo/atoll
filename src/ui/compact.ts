import type { AppViewModel } from "../app/types";
import { icon } from "../icons";
import { copyFor } from "../i18n";
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
  const copy = copyFor(vm.settings.language);
  const current = vm.media;
  const commandPending = vm.pendingMediaCommand !== null;
  const toggleLabel = current.playing ? copy.actions.pause : copy.actions.play;
  return `
    <div class="atoll-shell compact compact--media${motionClass}" ${shellGeometryStyle("compact")} role="group" aria-label="${copy.media.currentControls}">
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
    </div>`;
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
    default:
      return `
        <span class="mark mark--compact">${icon("atoll")}</span>
        <span class="compact__copy"><strong>Atoll</strong><small>${copy.shell.tagline}</small></span>`;
  }
}
