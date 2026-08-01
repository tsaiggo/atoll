import type { AppViewModel } from "../app/types";
import { formatPlaybackTime, mediaPositionMs, type MediaStatus } from "../domain";
import { shellGeometryStyle } from "../shell/geometry";
import { renderCompactShell } from "./compact";
import { renderExpandedShell } from "./expanded";

export function renderApp(root: HTMLElement, vm: AppViewModel): void {
  const focusedAction = root
    .querySelector<HTMLElement>("[data-action]:focus")
    ?.dataset.action;
  root.dataset.shell = vm.shell;
  root.dataset.content = vm.content;
  root.classList.toggle("motion-disabled", vm.motionDisabled);

  if (vm.shell === "hidden") {
    root.innerHTML = "";
    return;
  }
  if (vm.shell === "reef") {
    root.innerHTML = `
      <button class="atoll-shell reef" ${shellGeometryStyle("reef")} type="button" aria-label="Open Atoll">
        <span class="reef__tide"></span>
      </button>`;
    return;
  }
  if (vm.shell === "compact") {
    root.innerHTML = renderCompactShell(vm);
    restoreFocusedAction(root, focusedAction);
    return;
  }
  root.innerHTML = renderExpandedShell(vm);
  restoreFocusedAction(root, focusedAction);
}

export function updateMediaProgress(
  root: HTMLElement,
  media: MediaStatus | null,
  now = Date.now(),
): void {
  if (!media || media.durationMs === undefined || media.durationMs <= 0) return;
  const position = mediaPositionMs(media, now);
  const ratio = Math.min(1, Math.max(0, position / media.durationMs));
  const progress = root.querySelector<HTMLElement>("[data-media-progress]");
  const elapsed = root.querySelector<HTMLElement>("[data-media-elapsed]");
  if (progress) {
    progress.style.transform = `scaleX(${ratio})`;
    progress.parentElement?.setAttribute("aria-valuenow", String(Math.floor(position / 1000)));
    progress.parentElement?.setAttribute(
      "aria-valuetext",
      `${formatPlaybackTime(position)} of ${formatPlaybackTime(media.durationMs)}`,
    );
  }
  if (elapsed) elapsed.textContent = formatPlaybackTime(position);
}

function restoreFocusedAction(root: HTMLElement, action?: string): void {
  if (!action) return;
  const target = Array.from(root.querySelectorAll<HTMLElement>("[data-action]")).find(
    (element) => element.dataset.action === action && !element.hasAttribute("disabled"),
  );
  target?.focus({ preventScroll: true });
}
