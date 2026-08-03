import type { AppViewModel } from "../app/types";
import {
  formatPlaybackTime,
  mediaPositionMs,
  type MediaStatus,
} from "../domain";
import { copyFor, type UiLanguage } from "../i18n";
import { icon } from "../icons";
import { shellGeometryStyle } from "../shell/geometry";
import { renderCompactShell } from "./compact";
import { renderExpandedShell } from "./expanded";

export function renderApp(root: HTMLElement, vm: AppViewModel): void {
  const copy = copyFor(vm.settings.language);
  const focusedAction = root
    .querySelector<HTMLElement>("[data-action]:focus")
    ?.dataset.action;
  const focusedInsideShell = Boolean(root.querySelector<HTMLElement>(":focus"));
  root.dataset.shell = vm.shell;
  root.dataset.content = vm.content;
  root.classList.toggle("motion-disabled", vm.motionDisabled);
  document.documentElement.lang = vm.settings.language;

  if (vm.shell === "hidden") {
    root.innerHTML = "";
    return;
  }
  if (vm.shell === "reef") {
    const motionClass = vm.animateContent ? " shell-entering" : "";
    root.innerHTML = `
      <button class="atoll-shell reef${motionClass}" ${shellGeometryStyle("reef")} type="button" aria-label="${copy.shell.openAtoll}">
        <span class="reef__mark" aria-hidden="true">${icon("atoll")}</span>
      </button>`;
    if (focusedInsideShell) root.querySelector<HTMLElement>("button.reef")?.focus();
    return;
  }
  if (vm.shell === "compact") {
    root.innerHTML = renderCompactShell(vm);
    const actionRestored = restoreFocusedAction(root, focusedAction);
    if (!actionRestored && focusedInsideShell) restoreCompactFocus(root);
    return;
  }
  root.innerHTML = renderExpandedShell(vm);
  const actionRestored = restoreFocusedAction(root, focusedAction);
  if (!actionRestored && focusedInsideShell) restoreExpandedFocus(root);
}

export function updateMediaProgress(
  root: HTMLElement,
  media: MediaStatus | null,
  language: UiLanguage,
  now = Date.now(),
): void {
  if (!media || media.durationMs === undefined || media.durationMs <= 0) return;
  const position = mediaPositionMs(media, now);
  const ratio = Math.min(1, Math.max(0, position / media.durationMs));
  const progress = root.querySelector<HTMLElement>("[data-media-progress]");
  const elapsed = root.querySelector<HTMLElement>("[data-media-elapsed]");
  const copy = copyFor(language).media;
  if (progress) {
    progress.style.transform = `scaleX(${ratio})`;
    progress.parentElement?.setAttribute("aria-valuenow", String(Math.floor(position / 1000)));
    progress.parentElement?.setAttribute(
      "aria-valuetext",
      copy.progressValue(formatPlaybackTime(position), formatPlaybackTime(media.durationMs)),
    );
  }
  if (elapsed) elapsed.textContent = formatPlaybackTime(position);
}

function restoreFocusedAction(root: HTMLElement, action?: string): boolean {
  if (!action) return false;
  const target = Array.from(root.querySelectorAll<HTMLElement>("[data-action]")).find(
    (element) => element.dataset.action === action && !element.hasAttribute("disabled"),
  );
  target?.focus({ preventScroll: true });
  return Boolean(target);
}

function restoreCompactFocus(root: HTMLElement): void {
  const target = root.querySelector<HTMLElement>("button.compact, .compact-media__open");
  target?.focus({ preventScroll: true });
}

function restoreExpandedFocus(root: HTMLElement): void {
  const target =
    root.querySelector<HTMLElement>("[data-action='collapse']:not([disabled])") ??
    root.querySelector<HTMLElement>("[data-action]:not([disabled])");
  target?.focus({ preventScroll: true });
}
