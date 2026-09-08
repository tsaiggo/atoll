import type { AppViewModel } from "../app/types";
import {
  formatPlaybackTime,
  mediaPositionMs,
  type MediaStatus,
} from "../domain";
import { copyFor, type UiLanguage } from "../i18n";
import { notchGeometry } from "../shell/geometry";
import { renderNotch, updateNotchMediaProgress } from "./notch";
import { prepareNotchMotion, presentNotchMotion, type FrameSink } from "./notch-motion";

export function renderApp(root: HTMLElement, vm: AppViewModel, sink?: FrameSink): void {
  const focusedActionElement = root.querySelector<HTMLElement>("[data-action]:focus");
  const focusedAction = focusedActionElement?.dataset.action;
  const focusedControl = root.querySelector<HTMLElement>("[data-control]:focus")?.dataset.control;
  const previousPanel = root.dataset.panel;
  const detailScroll = root.querySelector<HTMLElement>(".notch-detail")?.scrollTop ?? 0;
  const sourceScroll = root.querySelector<HTMLElement>(".source-list")?.scrollTop ?? 0;
  const focusedActionValue = focusedActionElement?.dataset.value;
  const focusedInsideShell = Boolean(root.querySelector<HTMLElement>(":focus"));
  prepareNotchMotion(root, vm);
  root.dataset.shell = vm.shell;
  root.dataset.content = vm.content;
  root.dataset.edge = vm.settings.notchEdge;
  root.dataset.panel = vm.expandedPanel;
  root.classList.toggle("motion-disabled", vm.motionDisabled);
  document.documentElement.lang = vm.settings.language;

  if (vm.shell === "hidden") {
    root.innerHTML = "";
    presentNotchMotion(root, vm, sink);
    return;
  }
  const geometry = notchGeometry(vm.shell, vm.settings.notchEdge, vm.expandedPanel);
  root.style.width = `${geometry.width}px`;
  root.style.height = `${geometry.height}px`;
  root.innerHTML = renderNotch(vm);
  presentNotchMotion(root, vm, sink);
  const actionRestored = restoreFocusedAction(root, focusedAction, focusedActionValue);
  const controlTarget = focusedControl ? Array.from(root.querySelectorAll<HTMLElement>("[data-control]")).find(element => element.dataset.control === focusedControl) : undefined;
  if (!actionRestored) controlTarget?.focus({ preventScroll: true });
  if (previousPanel === vm.expandedPanel) {
    const detail = root.querySelector<HTMLElement>(".notch-detail");
    const sourceList = root.querySelector<HTMLElement>(".source-list");
    if (detail) detail.scrollTop = detailScroll;
    if (sourceList) sourceList.scrollTop = sourceScroll;
  }
  if (!actionRestored && !controlTarget && focusedInsideShell) {
    root.querySelector<HTMLElement>("button.reef, [data-notch-panel], [data-action=collapse]")?.focus({ preventScroll: true });
  }
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
  updateNotchMediaProgress(root, ratio);
  const progress = root.querySelector<HTMLElement>("[data-media-progress]");
  const seek = root.querySelector<HTMLInputElement>("[data-control='media-seek']");
  const elapsed = root.querySelector<HTMLElement>("[data-media-elapsed]");
  const copy = copyFor(language).media;
  const interactiveSeekInProgress =
    seek?.matches(":active") || seek?.dataset.seekPending === "true";
  if (seek && !interactiveSeekInProgress) {
    seek.value = String(Math.floor(position / 1000));
    seek.style.setProperty("--media-progress", `${ratio * 100}%`);
    seek.setAttribute(
      "aria-valuetext",
      copy.progressValue(formatPlaybackTime(position), formatPlaybackTime(media.durationMs)),
    );
  }
  if (progress) {
    progress.style.transform = `scaleX(${ratio})`;
    progress.parentElement?.setAttribute("aria-valuenow", String(Math.floor(position / 1000)));
    progress.parentElement?.setAttribute(
      "aria-valuetext",
      copy.progressValue(formatPlaybackTime(position), formatPlaybackTime(media.durationMs)),
    );
  }
  if (elapsed && !interactiveSeekInProgress) elapsed.textContent = formatPlaybackTime(position);
}

function restoreFocusedAction(root: HTMLElement, action?: string, value?: string): boolean {
  if (!action) return false;
  const actions = Array.from(root.querySelectorAll<HTMLElement>("[data-action]")).filter(
    (element) => element.dataset.action === action && !element.hasAttribute("disabled"),
  );
  const target =
    value === undefined ? actions[0] : actions.find((element) => element.dataset.value === value) ?? actions[0];
  target?.focus({ preventScroll: true });
  return Boolean(target);
}
