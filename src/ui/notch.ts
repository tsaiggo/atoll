import type { AppViewModel } from "../app/types";
import { formatCodexUsagePercent, formatEnergyMeasurement, mediaPositionMs, selectCodexUsageWindows } from "../domain";
import { copyFor } from "../i18n";
import { icon } from "../icons";
import { notchGeometry, type SurfaceRect } from "../shell/geometry";
import { escapeHtml } from "./escape";
import { renderExpandedShell } from "./expanded";

import { CODENOTCH as C, notchMetrics } from "../shell/codenotch";

const RING_RADIUS = (C.ring - C.track) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function notchUsageColor(usedPercent: number): string {
  return usedPercent < 50 ? "#00FF88" : usedPercent < 70 ? "#F2FF00" : "#FF3F00";
}

function rectStyle(rect: SurfaceRect): string {
  return `style="left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px"`;
}

function ring(progress: number | null, color = "#FFFFFF", media = false): string {

  const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress ?? 0)));
  return `<svg class="notch-ring__meter" viewBox="0 0 44 44" aria-hidden="true">
    <circle class="notch-ring__track" cx="22" cy="22" r="${RING_RADIUS}" />
    <circle class="notch-ring__signal" ${media ? "data-notch-media-progress" : ""} cx="22" cy="22" r="${RING_RADIUS}" stroke="${progress === null ? "transparent" : color}" stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${offset}" />
  </svg>`;
}

interface RingOptions {
  panel: "media" | "energy" | "codex";
  name: string;
  label: string;
  value: string;
  glyph: string;
  progress: number | null;
  color?: string;
  quiet?: boolean;
}

function ringButton(vm: AppViewModel, options: RingOptions): string {
  const selected = vm.shell === "expanded" &&
    (vm.expandedPanel === options.panel || (options.panel === "media" && vm.expandedPanel === "sources"));
  return `<button class="notch-ring${selected ? " is-selected" : ""}${options.quiet ? " is-quiet" : ""}${options.panel === "codex" && options.progress !== null && options.progress >= 1 ? " is-exhausted" : ""}" type="button" data-action="notch-panel" data-value="${options.panel}" data-notch-panel="${options.panel}" aria-label="${escapeHtml(options.label)}" aria-expanded="${selected}" aria-controls="notch-detail" title="${escapeHtml(options.label)}">
    <span class="notch-ring__visual">${ring(options.progress, options.color, options.panel === "media")}<span class="notch-ring__glyph">${options.glyph}</span></span>
    <span class="notch-ring__value" aria-hidden="true"${options.color ? ` style="color:${options.color}"` : ""}>${escapeHtml(options.value)}</span>
    <span class="sr-only">${escapeHtml(options.name)}</span>
  </button>`;
}

export function renderNotch(vm: AppViewModel): string {
  if (vm.shell === "hidden") return "";
  const copy = copyFor(vm.settings.language);
  const geometry = notchGeometry(vm.shell, vm.settings.notchEdge, vm.expandedPanel);
  const metrics = notchMetrics(vm.settings.notchEdge === "left" || vm.settings.notchEdge === "right");
  const railClip = geometry.regions[0].points.map(p => `${p.x - geometry.rail.x}px ${p.y - geometry.rail.y}px`).join(",");
  const railStyle = rectStyle(geometry.rail).replace('px"', `px;clip-path:polygon(${railClip});--ring-lead:${metrics.lead}px;--ring-margin:${metrics.ringMargin}px;--cell-height:${metrics.cellHeight}px;--ring-spacing:${C.spacing}px;--ring-label-gap:${C.labelGap}px;--ring-label-font:${C.labelFont}px"`);
  const surfaceParts = geometry.path.split(" Z");
  const surface = `<svg class="notch-surface" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 ${geometry.width} ${geometry.height}" aria-hidden="true"><path class="notch-outline" d="${surfaceParts[0]} Z" /><path class="notch-bubble-outline" d="${surfaceParts.slice(1).join(" Z")}" /><g class="notch-hit-regions">${geometry.regions.map(region => `<polygon points="${region.points.map(p => `${p.x},${p.y}`).join(" ")}" />`).join("")}</g></svg>`;
  if (vm.shell === "reef") {
    return `${surface}<button class="atoll-shell reef notch-reef" ${rectStyle(geometry.rail)} type="button" aria-label="${escapeHtml(copy.shell.openAtoll)}"></button>`;
  }

  const media = vm.media;
  const duration = media?.durationMs;
  const mediaProgress = media && duration && duration > 0 ? mediaPositionMs(media, vm.now) / duration : null;
  const measurement = formatEnergyMeasurement(vm.energy.todayMwh, vm.settings.language);
  const codex = vm.codexUsage.status === "ready" ? selectCodexUsageWindows(vm.codexUsage.windows).primary : null;
  const codexValue = codex ? `${formatCodexUsagePercent(codex.usedPercent, vm.settings.language)}%` : "—";
  const mediaGlyph = media?.artworkDataUrl
    ? `<img class="notch-ring__cover" src="${escapeHtml(media.artworkDataUrl)}" alt="" />`
    : icon("media");
  const energyGlyph = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 5 13h6l-1 9 9-12h-6l1-8Z" /></svg>';
  const codexGlyph = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-12-2 14" /></svg>';
  const buttons = [
    ringButton(vm, { panel: "media", name: copy.notch.media, label: media ? `${copy.notch.media} · ${media.title} · ${media.artist}` : copy.media.noMedia, value: copy.notch.media, glyph: mediaGlyph, progress: mediaProgress, quiet: !media }),
    ringButton(vm, { panel: "energy", name: copy.notch.energy, label: `${copy.notch.energy} · ${vm.energy.available ? `${measurement.value} ${measurement.unit}` : copy.energy.capacityUnavailable}`, value: vm.energy.available ? `${measurement.value} ${measurement.unit}` : "—", glyph: energyGlyph, progress: null, quiet: !vm.energy.available }),
    ringButton(vm, { panel: "codex", name: copy.notch.codex, label: `${copy.notch.codex} · ${codex ? codexValue : copy.codex.openUsage}`, value: codexValue, glyph: codexGlyph, progress: codex ? codex.usedPercent / 100 : null, color: codex ? notchUsageColor(codex.usedPercent) : undefined, quiet: !codex }),
  ].join("");
  const pinLabel = vm.notchPinned ? copy.notch.unpin : copy.notch.pin;
  return `${surface}
    <div class="atoll-shell notch-rail${vm.animateContent ? " notch-entering" : ""}" ${railStyle} role="group" aria-label="${escapeHtml(copy.shell.quickControls)}">
      <div class="notch-rings">${buttons}</div>
      <button class="notch-pin" type="button" data-action="notch-pin" aria-label="${escapeHtml(pinLabel)}" aria-pressed="${Boolean(vm.notchPinned)}" title="${escapeHtml(pinLabel)}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 2h6l-1 4 2 2v1H4V8l2-2-1-4Zm3 7v5" /></svg></button>
      <button class="notch-collapse" type="button" data-action="collapse" aria-label="${escapeHtml(copy.shell.collapseAtoll)}" title="${escapeHtml(copy.shell.collapseAtoll)}">${icon("atoll")}</button>
    </div>
    ${geometry.orb ? `<button class="notch-settings" ${rectStyle(geometry.orb)} type="button" data-action="notch-panel" data-value="settings" data-notch-panel="settings" aria-label="${escapeHtml(copy.notch.openSettings)}" aria-expanded="${vm.shell === "expanded" && vm.expandedPanel === "settings"}" aria-controls="notch-detail" title="${escapeHtml(copy.notch.openSettings)}"><svg class="notch-settings__arc" viewBox="-36 -36 72 72" aria-hidden="true"><path d="M 28.581 0 A 28.581 28.581 0 0 0 0 -28.581" /></svg><span class="notch-settings__disc">${icon("gear")}</span></button>` : ""}
    ${geometry.panel ? `<div class="notch-detail" id="notch-detail" ${rectStyle(geometry.panel)}>${renderExpandedShell(vm)}</div>` : ""}`;
}

export function updateNotchMediaProgress(root: HTMLElement, ratio: number): void {
  root.querySelector<SVGCircleElement>("[data-notch-media-progress]")?.setAttribute(
    "stroke-dashoffset", String(RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, ratio)))),
  );
}
