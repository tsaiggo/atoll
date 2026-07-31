import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { consumeFirstRun, loadSettings, resetSettings, saveSettings, type AtollSettings } from "./config";
import {
  createTimer,
  DEMO_MEDIA,
  EMPTY_TIMER,
  formatDuration,
  formatPlaybackTime,
  mediaPositionMs,
  normalizeMedia,
  pauseTimer,
  reconcileTimer,
  remainingMs,
  restartTimer,
  resumeTimer,
  type ContentKind,
  type MediaConnection,
  type MediaStatus,
  type NativeMediaPayload,
  type NativeMediaUpdatePayload,
  type NativeVolumePayload,
  type ShellState,
  type TimerStatus,
  type VolumeStatus,
} from "./domain";
import { icon } from "./icons";
import "./styles.css";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

type ExpandedPanel = "home" | "media" | "timer" | "settings" | "timer-finished";
type PreviewMode = "reef" | "compact-media" | "expanded-media" | "timer-finished";
type MediaCommand = "previous" | "toggle" | "next";

interface MediaCommandFeedback {
  message: string;
  failed: boolean;
}

interface WindowDimensions {
  width: number;
  height: number;
  cornerRadius: number;
}

interface NativeAcceptedShell {
  shell: ShellState;
  signature: string;
}

const appElement = document.querySelector<HTMLElement>("#app");
if (!appElement) throw new Error("Atoll root element was not found.");
const app: HTMLElement = appElement;

const TIMER_STORAGE_KEY = "atoll.timer.v1";
const nativeRuntime = Boolean(window.__TAURI_INTERNALS__);
const requestedPreviewMode = new URLSearchParams(location.search).get("preview");
const previewMode =
  import.meta.env.DEV && isPreviewMode(requestedPreviewMode) ? requestedPreviewMode : null;
document.documentElement.classList.toggle("native-runtime", nativeRuntime);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const lightColorScheme = window.matchMedia("(prefers-color-scheme: light)");
const dimensions: Record<Exclude<ShellState, "hidden">, WindowDimensions> = {
  reef: { width: 80, height: 12, cornerRadius: 12 },
  compact: { width: 188, height: 44, cornerRadius: 22 },
  expanded: { width: 384, height: 148, cornerRadius: 12 },
};

let settings = loadSettings();
let shell: ShellState = "hidden";
let lastVisibleShell: Exclude<ShellState, "hidden"> = "reef";
let content: ContentKind = "idle";
let expandedPanel: ExpandedPanel = "home";
let media: MediaStatus | null = null;
let mediaConnection: MediaConnection = { status: "checking", sessionCount: 0 };
let volume: VolumeStatus = { level: 0, muted: false };
let timer: TimerStatus = loadTimer();
let fullscreen = false;
let fullscreenOverride = false;
let demoOverride: ContentKind | null = null;
let transientExpiryId: number | null = null;
let expandedExpiryId: number | null = null;
let expandedExpiryDeadline = 0;
let expandedSessionRevision = 0;
let timerTickId: number | null = null;
let mediaProgressTickId: number | null = null;
let volumeVisibleUntil = 0;
let mediaFlashUntil = 0;
let lastMediaIdentity = "";
let pendingMediaCommand: MediaCommand | null = null;
let mediaCommandFeedback: MediaCommandFeedback | null = null;
let mediaCommandFeedbackId: number | null = null;
let firstRun = previewMode ? false : consumeFirstRun();
let animateNextShellContent = false;
let manuallyHidden = false;
let shellRevision = 0;
let nativeAcceptedShell: NativeAcceptedShell | null = null;
let nativeShellQueue: Promise<void> = Promise.resolve();

function isPreviewMode(value: string | null): value is PreviewMode {
  return (
    value === "reef" ||
    value === "compact-media" ||
    value === "expanded-media" ||
    value === "timer-finished"
  );
}

function shellGeometryStyle(state: Exclude<ShellState, "hidden">): string {
  return `style="--shell-bottom-radius:${dimensions[state].cornerRadius}px"`;
}

app.addEventListener("click", onClick);
app.addEventListener("contextmenu", onContextMenu);
app.addEventListener("pointerenter", onExpandedActivity);
app.addEventListener("pointermove", onExpandedActivity);
app.addEventListener("pointerdown", onExpandedActivity);
app.addEventListener("pointerleave", onExpandedActivity);
app.addEventListener("pointercancel", onExpandedActivity);
window.addEventListener("keydown", onKeyDown);
reducedMotion.addEventListener("change", () => render());
lightColorScheme.addEventListener("change", () => {
  nativeAcceptedShell = null;
  if (nativeRuntime && shell !== "hidden") {
    void setShell(shell, false, true);
  }
});
document.addEventListener("visibilitychange", () => {
  if (!previewMode && !document.hidden) {
    reconcilePresentation();
  }
  scheduleMediaProgressTick();
});

if (previewMode) {
  configurePreview(previewMode);
} else {
  startApplication();
}

async function startApplication(): Promise<void> {
  if (nativeRuntime) {
    fullscreen = await invoke<boolean>("is_fullscreen_active").catch(() => false);
  }
  timer = reconcileTimer(timer);
  if (shouldHideForFullscreen()) {
    await setShell("hidden", false);
  } else if (timer.phase === "finished") {
    content = "timer-finished";
    expandedPanel = "timer-finished";
    await setShell("compact", false);
  } else if (firstRun) {
    content = "welcome";
    await setShell("compact", false);
    setTransientExpiry(4200);
  } else {
    reconcilePresentation(false);
  }
  scheduleTimerTick();

  if (!nativeRuntime) return;
  await Promise.all([
    listen<string>("atoll-action", ({ payload }) => applyExternalAction(payload)),
    listen<NativeMediaUpdatePayload>("media-update", ({ payload }) => updateMediaConnect(payload)),
    listen<NativeVolumePayload>("system-volume", ({ payload }) => updateVolume(payload)),
    listen("timer-elapsed", () => {
      if (timer.phase !== "running") return;
      timer = reconcileTimer(timer);
      if (timer.phase !== "finished") {
        timer = { ...timer, phase: "finished", endAt: null, pausedRemainingMs: 0 };
      }
      finishTimer();
    }),
    listen<{ fullscreen: boolean }>("fullscreen-changed", ({ payload }) => {
      fullscreen = payload.fullscreen;
      if (!fullscreen) fullscreenOverride = false;
      reconcilePresentation();
    }),
  ]).catch((error: unknown) => console.warn("Atoll event bridge unavailable", error));
  const initialMedia = await invoke<NativeMediaUpdatePayload>("media_status").catch(
    (error: unknown) => {
      console.warn("Unable to read the initial media state", error);
      return null;
    },
  );
  if (initialMedia) updateMediaConnect(initialMedia);
  syncNativeTimer();
}

function configurePreview(mode: PreviewMode): void {
  media = { ...DEMO_MEDIA };
  mediaConnection = { status: "ready", sessionCount: 1 };
  let previewShell: ShellState;
  switch (mode) {
    case "reef":
      content = "idle";
      previewShell = "reef";
      break;
    case "compact-media":
      content = "media";
      previewShell = "compact";
      break;
    case "expanded-media":
      content = "media";
      expandedPanel = "media";
      previewShell = "expanded";
      break;
    case "timer-finished":
      timer = {
        phase: "finished",
        durationMs: 25 * 60_000,
        endAt: null,
        pausedRemainingMs: 0,
      };
      content = "timer-finished";
      expandedPanel = "timer-finished";
      previewShell = "expanded";
      break;
  }
  void setShell(previewShell, false, true);
  scheduleMediaProgressTick();
}

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const actionable = target.closest<HTMLElement>("[data-action]");
  if (actionable) {
    event.stopPropagation();
    void runAction(actionable.dataset.action ?? "", actionable.dataset.value);
    return;
  }

  if (shell === "reef") {
    expandedPanel = "home";
    void setShell("expanded");
  } else if (shell === "compact") {
    expandedPanel = panelForContent(content);
    void setShell("expanded");
  } else if (shell === "expanded") {
    collapse();
  }
}

function onContextMenu(event: MouseEvent): void {
  event.preventDefault();
  if (nativeRuntime) {
    void invoke("show_context_menu").catch((error: unknown) =>
      console.warn("Unable to open the Atoll menu", error),
    );
  }
}

function onExpandedActivity(): void {
  resetExpandedExpiry();
}

function onKeyDown(event: KeyboardEvent): void {
  resetExpandedExpiry();
  if (event.key === "Escape" && shell === "expanded") {
    event.preventDefault();
    collapse();
  }
}

async function runAction(action: string, value?: string): Promise<void> {
  resetExpandedExpiry();
  switch (action) {
    case "collapse":
      collapse();
      break;
    case "open-home":
      expandedPanel = "home";
      reconcilePresentation();
      break;
    case "open-media":
      expandedPanel = "media";
      await setShell("expanded");
      break;
    case "open-settings":
      expandedPanel = "settings";
      content = "settings";
      await setShell("expanded");
      break;
    case "start-timer":
      startTimer(Number(value));
      break;
    case "toggle-timer":
      timer = timer.phase === "running" ? pauseTimer(timer) : resumeTimer(timer);
      persistTimer();
      content = timer.phase === "finished" ? "timer-finished" : "timer";
      render();
      scheduleTimerTick();
      break;
    case "cancel-timer":
      timer = { ...EMPTY_TIMER };
      persistTimer();
      demoOverride = null;
      expandedPanel = "home";
      reconcilePresentation();
      break;
    case "restart-timer":
      timer = restartTimer(timer);
      persistTimer();
      content = "timer";
      expandedPanel = "timer";
      await setShell("expanded");
      scheduleTimerTick();
      break;
    case "dismiss-finished":
      timer = { ...EMPTY_TIMER };
      persistTimer();
      demoOverride = null;
      expandedPanel = "home";
      reconcilePresentation();
      break;
    case "media-previous":
    case "media-toggle":
    case "media-next":
      await sendMediaCommand(action.replace("media-", "") as MediaCommand);
      break;
    case "toggle-setting":
      toggleSetting(value);
      break;
    case "set-idle":
      settings = { ...settings, idleMode: value === "hidden" ? "hidden" : "reef" };
      saveSettings(settings);
      render();
      break;
    case "reset-settings":
      settings = resetSettings();
      render();
      break;
    case "hide":
      manuallyHidden = true;
      await setShell("hidden");
      break;
  }
}

function applyExternalAction(action: string): void {
  switch (action) {
    case "toggle":
      manuallyHidden = false;
      if (fullscreen) fullscreenOverride = true;
      if (shell === "expanded") collapse();
      else {
        expandedPanel = "home";
        void setShell("expanded");
      }
      break;
    case "show":
    case "expand":
    case "single-instance":
      manuallyHidden = false;
      if (fullscreen) fullscreenOverride = true;
      expandedPanel = "home";
      void setShell("expanded");
      break;
    case "hide":
      manuallyHidden = true;
      void setShell("hidden");
      break;
    case "collapse":
      collapse();
      break;
    case "settings":
      manuallyHidden = false;
      expandedPanel = "settings";
      content = "settings";
      void setShell("expanded");
      break;
    case "demo:idle":
      manuallyHidden = false;
      demoOverride = "idle";
      timer = { ...EMPTY_TIMER };
      persistTimer();
      media = null;
      reconcilePresentation();
      break;
    case "demo:media":
      manuallyHidden = false;
      demoOverride = "media";
      updateMedia(
        {
          title: DEMO_MEDIA.title,
          artist: DEMO_MEDIA.artist,
          source: DEMO_MEDIA.source,
          playing: true,
          can_previous: true,
          can_play_pause: true,
          can_next: true,
          can_seek: true,
          position_ms: DEMO_MEDIA.positionMs,
          duration_ms: DEMO_MEDIA.durationMs,
          position_updated_at_ms: Date.now(),
          session_revision: DEMO_MEDIA.sessionRevision,
        },
        true,
      );
      break;
    case "demo:volume":
      manuallyHidden = false;
      demoOverride = "volume";
      updateVolume({ level: 0.68, muted: false });
      break;
    case "demo:timer-running":
      manuallyHidden = false;
      demoOverride = "timer";
      startTimer(5);
      break;
    case "demo:timer-finished":
      manuallyHidden = false;
      demoOverride = "timer-finished";
      timer = {
        phase: "finished",
        durationMs: 25 * 60_000,
        endAt: null,
        pausedRemainingMs: 0,
      };
      persistTimer();
      finishTimer();
      break;
  }
}

function updateMediaConnect(payload: NativeMediaUpdatePayload): void {
  if (demoOverride) return;
  const status = [
    "checking",
    "ready",
    "no_session",
    "metadata_unavailable",
    "unavailable",
  ].includes(payload.status ?? "")
    ? (payload.status ?? "checking")
    : "unavailable";
  const sessionCount =
    typeof payload.session_count === "number" && Number.isFinite(payload.session_count)
      ? Math.max(0, Math.floor(payload.session_count))
      : 0;
  mediaConnection = { status, sessionCount };
  updateMedia(payload.media ?? null);
}

function updateMedia(payload: NativeMediaPayload | null, fromDemo = false): void {
  if (demoOverride && !fromDemo) return;
  const next = payload ? normalizeMedia(payload) : null;
  if (
    next &&
    media &&
    payload?.artwork_data_url == null &&
    next.sessionRevision === media.sessionRevision &&
    next.source === media.source &&
    next.title === media.title &&
    next.artist === media.artist
  ) {
    next.artworkDataUrl = media.artworkDataUrl;
  }
  const mediaIdentity = next ? mediaIdentityFor(next) : "";
  const trackChanged = Boolean(next && mediaIdentity !== lastMediaIdentity);
  media = next;
  lastMediaIdentity = mediaIdentity;
  if (fromDemo) mediaConnection = { status: "ready", sessionCount: 1 };
  scheduleMediaProgressTick();
  if (next && trackChanged) {
    mediaFlashUntil = Date.now() + settings.compactTimeoutMs;
    content = "media";
    if (!manuallyHidden && shell !== "expanded") void setShell("compact");
    setTransientExpiry(settings.compactTimeoutMs);
  } else {
    reconcilePresentation();
  }
  render();
}

function updateVolume(payload: NativeVolumePayload): void {
  volume = {
    level: Math.min(1, Math.max(0, payload.level)),
    muted: payload.muted,
  };
  if (payload.initial) return;
  volumeVisibleUntil = Date.now() + 1800;
  if (manuallyHidden) return;
  if (shell === "expanded") {
    render();
    setTransientExpiry(1800);
    return;
  }
  content = "volume";
  void setShell("compact");
  setTransientExpiry(1800);
}

function startTimer(minutes: number): void {
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  demoOverride = demoOverride === "timer" ? demoOverride : null;
  timer = createTimer(minutes);
  persistTimer();
  content = "timer";
  expandedPanel = "timer";
  void setShell("expanded");
  scheduleTimerTick();
}

function finishTimer(): void {
  timer = {
    ...timer,
    phase: "finished",
    endAt: null,
    pausedRemainingMs: 0,
  };
  persistTimer();
  content = "timer-finished";
  expandedPanel = "timer-finished";
  clearTransientExpiry();
  void setShell(
    manuallyHidden || shouldHideForFullscreen()
      ? "hidden"
      : shell === "expanded"
        ? "expanded"
        : "compact",
  );
  playTimerTone();
  scheduleTimerTick();
}

function scheduleTimerTick(): void {
  if (timerTickId !== null) {
    window.clearInterval(timerTickId);
    timerTickId = null;
  }
  if (timer.phase !== "running") return;
  timerTickId = window.setInterval(() => {
    const next = reconcileTimer(timer);
    if (next.phase === "finished") {
      timer = next;
      finishTimer();
      return;
    }
    if (shell !== "hidden") render();
  }, 500);
}

function scheduleMediaProgressTick(): void {
  if (mediaProgressTickId !== null) {
    window.clearInterval(mediaProgressTickId);
    mediaProgressTickId = null;
  }
  if (
    document.hidden ||
    shell !== "expanded" ||
    expandedPanel !== "media" ||
    !media?.playing ||
    media.positionMs === undefined ||
    media.durationMs === undefined ||
    media.durationMs <= 0
  ) {
    return;
  }
  mediaProgressTickId = window.setInterval(refreshMediaProgress, 500);
}

function refreshMediaProgress(): void {
  if (!media || media.durationMs === undefined || media.durationMs <= 0) return;
  const position = mediaPositionMs(media);
  const ratio = Math.min(1, Math.max(0, position / media.durationMs));
  const progress = app.querySelector<HTMLElement>("[data-media-progress]");
  const elapsed = app.querySelector<HTMLElement>("[data-media-elapsed]");
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

function reconcilePresentation(
  animate = settings.animationsEnabled && !reducedMotion.matches,
  preserveExpanded = true,
): void {
  timer = reconcileTimer(timer);
  if (manuallyHidden) {
    void setShell("hidden", animate);
    return;
  }
  if (timer.phase === "finished") {
    content = "timer-finished";
    if (!preserveExpanded || shell !== "expanded") void setShell("compact", animate);
    else render();
    return;
  }

  if (shouldHideForFullscreen()) {
    void setShell("hidden", animate);
    return;
  }

  const now = Date.now();
  if (demoOverride === "idle") {
    content = "idle";
  } else if (now < volumeVisibleUntil) {
    content = "volume";
  } else if (now < mediaFlashUntil && media) {
    content = "media";
  } else if (timer.phase === "running" || timer.phase === "paused") {
    content = "timer";
  } else if (media) {
    content = "media";
  } else if (firstRun) {
    content = "welcome";
  } else {
    content = "idle";
  }

  if (preserveExpanded && shell === "expanded") {
    render();
  } else if (content === "idle") {
    void setShell(settings.idleMode === "hidden" ? "hidden" : "reef", animate);
  } else {
    void setShell("compact", animate);
  }
}

function shouldHideForFullscreen(): boolean {
  if (!fullscreen || fullscreenOverride || !settings.hideInFullscreen) return false;
  return !(timer.phase === "finished" && settings.timerBreaksFullscreen);
}

function collapse(): void {
  clearExpandedExpiry();
  if (content === "settings") content = "idle";
  reconcilePresentation(settings.animationsEnabled && !reducedMotion.matches, false);
}

async function setShell(
  next: ShellState,
  animated = settings.animationsEnabled && !reducedMotion.matches,
  forceNative = false,
): Promise<void> {
  const previous = shell;
  const enteredExpanded = previous !== "expanded" && next === "expanded";
  if (next !== "expanded") clearExpandedExpiry();
  if (previous !== next || forceNative) shellRevision += 1;
  const revision = shellRevision;
  animateNextShellContent = animated && previous !== next;
  shell = next;
  if (next !== "hidden") lastVisibleShell = next;
  render();
  if (!previewMode && enteredExpanded) {
    setExpandedExpiry();
  } else if (!previewMode && next === "expanded" && expandedExpiryId === null) {
    resetExpandedExpiry();
  }
  if (!nativeRuntime) return;

  const geometry = next === "hidden" ? dimensions[lastVisibleShell] : dimensions[next];
  const theme = lightColorScheme.matches ? "light" : "dark";
  const signature = `${next}:${geometry.width}x${geometry.height}:r${geometry.cornerRadius}:${settings.topMargin}:${theme}`;
  const syncNativeShell = async (): Promise<void> => {
    if (revision !== shellRevision) return;
    if (!forceNative && nativeAcceptedShell?.signature === signature) {
      return;
    }
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await invoke("set_window_shell", {
          shell: next,
          width: geometry.width,
          height: geometry.height,
          cornerRadius: geometry.cornerRadius,
          animated: attempt === 0 ? animated : false,
          topMargin: settings.topMargin,
          theme,
        });
        nativeAcceptedShell = { shell: next, signature };
        return;
      } catch (error: unknown) {
        lastError = error;
        if (revision !== shellRevision) return;
      }
    }

    console.warn("Unable to update the Atoll shell after retrying", lastError);
    const fallback = nativeAcceptedShell?.shell ?? "hidden";
    if (fallback !== shell) {
      void setShell(fallback, false);
    }
  };
  const operation = nativeShellQueue.then(syncNativeShell, syncNativeShell);
  nativeShellQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  await operation;
}

function setTransientExpiry(milliseconds: number): void {
  clearTransientExpiry();
  transientExpiryId = window.setTimeout(() => {
    transientExpiryId = null;
    firstRun = false;
    demoOverride = demoOverride === "volume" ? null : demoOverride;
    reconcilePresentation();
  }, milliseconds);
}

function clearTransientExpiry(): void {
  if (transientExpiryId === null) return;
  window.clearTimeout(transientExpiryId);
  transientExpiryId = null;
}

function setExpandedExpiry(): void {
  clearExpandedExpiry();
  expandedExpiryDeadline = Date.now() + settings.expandedTimeoutMs;
  scheduleExpandedExpiry(expandedSessionRevision);
}

function scheduleExpandedExpiry(sessionRevision: number): void {
  const delay = Math.max(0, expandedExpiryDeadline - Date.now());
  expandedExpiryId = window.setTimeout(() => {
    expandedExpiryId = null;
    if (sessionRevision !== expandedSessionRevision || shell !== "expanded") return;

    if (pendingMediaCommand !== null) {
      expandedExpiryDeadline = Date.now() + settings.expandedTimeoutMs;
      scheduleExpandedExpiry(sessionRevision);
      return;
    }

    const remaining = expandedExpiryDeadline - Date.now();
    if (remaining > 0) {
      scheduleExpandedExpiry(sessionRevision);
      return;
    }

    collapse();
  }, delay);
}

function resetExpandedExpiry(): void {
  if (previewMode || shell !== "expanded") return;
  expandedExpiryDeadline = Date.now() + settings.expandedTimeoutMs;
  if (expandedExpiryId === null) scheduleExpandedExpiry(expandedSessionRevision);
}

function clearExpandedExpiry(): void {
  expandedSessionRevision += 1;
  expandedExpiryDeadline = 0;
  if (expandedExpiryId !== null) window.clearTimeout(expandedExpiryId);
  expandedExpiryId = null;
}

async function sendMediaCommand(command: MediaCommand): Promise<void> {
  const current = media;
  if (!current || !mediaCommandEnabled(command, current) || pendingMediaCommand !== null) return;

  if (!nativeRuntime || demoOverride === "media") {
    if (command === "toggle") media = optimisticPlaybackToggle(current);
    render();
    return;
  }

  const sessionRevision = current.sessionRevision;
  const identity = mediaIdentityFor(current);
  const previousPlaying = current.playing;
  pendingMediaCommand = command;
  setMediaCommandFeedback(commandPendingMessage(command, current), false);
  if (command === "toggle") media = optimisticPlaybackToggle(current);
  render();

  let accepted = false;
  try {
    accepted = await invoke<boolean>("media_command", { command, sessionRevision });
  } catch (error: unknown) {
    console.warn(`Media command '${command}' failed`, error);
  }

  const sameTarget =
    media?.sessionRevision === sessionRevision && mediaIdentityFor(media) === identity;
  if (!accepted && command === "toggle" && sameTarget && media) {
    media = {
      ...media,
      playing: previousPlaying,
      positionUpdatedAtMs: Date.now(),
    };
  }

  pendingMediaCommand = null;
  if (!accepted && sameTarget) {
    setMediaCommandFeedback("Control unavailable", true, 1600);
  } else {
    setMediaCommandFeedback(null);
  }
  render();
}

function mediaCommandEnabled(command: MediaCommand, current: MediaStatus): boolean {
  if (command === "previous") return current.canPrevious;
  if (command === "next") return current.canNext;
  return current.canPlayPause;
}

function optimisticPlaybackToggle(current: MediaStatus): MediaStatus {
  const now = Date.now();
  return {
    ...current,
    playing: !current.playing,
    positionMs: current.playing ? mediaPositionMs(current, now) : current.positionMs,
    positionUpdatedAtMs: now,
  };
}

function commandPendingMessage(command: MediaCommand, current: MediaStatus): string {
  if (command === "previous") return "Going to previous track…";
  if (command === "next") return "Going to next track…";
  return current.playing ? "Pausing…" : "Playing…";
}

function setMediaCommandFeedback(
  feedback: string | null,
  failed = false,
  clearAfterMs?: number,
): void {
  if (mediaCommandFeedbackId !== null) {
    window.clearTimeout(mediaCommandFeedbackId);
    mediaCommandFeedbackId = null;
  }
  mediaCommandFeedback = feedback ? { message: feedback, failed } : null;
  if (feedback && clearAfterMs !== undefined) {
    mediaCommandFeedbackId = window.setTimeout(() => {
      mediaCommandFeedbackId = null;
      mediaCommandFeedback = null;
      if (shell === "expanded" && expandedPanel === "media") render();
    }, clearAfterMs);
  }
}

function mediaIdentityFor(current: MediaStatus): string {
  return `${current.sessionRevision}\u001f${current.source}\u001f${current.title}\u001f${current.artist}`;
}

function toggleSetting(settingName?: string): void {
  if (!settingName) return;
  if (settingName === "animationsEnabled") {
    settings = { ...settings, animationsEnabled: !settings.animationsEnabled };
  } else if (settingName === "soundsEnabled") {
    settings = { ...settings, soundsEnabled: !settings.soundsEnabled };
  } else if (settingName === "hideInFullscreen") {
    settings = { ...settings, hideInFullscreen: !settings.hideInFullscreen };
  } else if (settingName === "timerBreaksFullscreen") {
    settings = { ...settings, timerBreaksFullscreen: !settings.timerBreaksFullscreen };
  }
  saveSettings(settings);
  reconcilePresentation();
}

function panelForContent(kind: ContentKind): ExpandedPanel {
  if (kind === "timer" || kind === "timer-finished") return kind;
  if (kind === "media") return "media";
  if (kind === "settings") return "settings";
  return "home";
}

function render(): void {
  const focusedAction = app
    .querySelector<HTMLElement>("[data-action]:focus")
    ?.dataset.action;
  app.dataset.shell = shell;
  app.dataset.content = content;
  app.classList.toggle("motion-disabled", !settings.animationsEnabled || reducedMotion.matches);
  const motionClass = animateNextShellContent ? " shell-entering" : "";
  animateNextShellContent = false;

  if (shell === "hidden") {
    app.innerHTML = "";
    scheduleMediaProgressTick();
    return;
  }
  if (shell === "reef") {
    app.innerHTML = `
      <button class="atoll-shell reef" ${shellGeometryStyle("reef")} type="button" aria-label="Open Atoll">
        <span class="reef__tide"></span>
      </button>`;
    scheduleMediaProgressTick();
    return;
  }
  if (shell === "compact") {
    app.innerHTML =
      content === "media" && media
        ? renderCompactMedia(motionClass)
        : `
          <button class="atoll-shell compact compact--${content}${motionClass}" ${shellGeometryStyle("compact")} type="button" aria-label="${escapeHtml(compactAccessibleLabel())}">
            ${renderCompact()}
          </button>`;
    restoreFocusedAction(focusedAction);
    scheduleMediaProgressTick();
    return;
  }
  app.innerHTML = `
    <section class="atoll-shell expanded expanded--${expandedPanel}${motionClass}" ${shellGeometryStyle("expanded")} aria-label="Atoll quick controls">
      ${renderExpanded()}
    </section>`;
  restoreFocusedAction(focusedAction);
  scheduleMediaProgressTick();
}

function restoreFocusedAction(action?: string): void {
  if (!action) return;
  const target = Array.from(app.querySelectorAll<HTMLElement>("[data-action]")).find(
    (element) => element.dataset.action === action && !element.hasAttribute("disabled"),
  );
  target?.focus({ preventScroll: true });
}

function renderCompactMedia(motionClass: string): string {
  if (!media) return "";
  const current = media;
  const commandPending = pendingMediaCommand !== null;
  const toggleLabel = current.playing ? "Pause" : "Play";
  return `
    <div class="atoll-shell compact compact--media${motionClass}" ${shellGeometryStyle("compact")} role="group" aria-label="Current media controls">
      <button class="compact-media__open" type="button" data-action="open-media" aria-label="Open media controls for ${escapeHtml(current.title)}">
        ${renderCover(current, "cover cover--compact")}
        <span class="compact__copy" title="${escapeAttribute(`${current.title} — ${current.artist}`)}">
          <strong>${escapeHtml(current.title)}</strong>
          <small>${escapeHtml(current.artist)}</small>
        </span>
      </button>
      <button class="compact-media__toggle ${pendingMediaCommand === "toggle" ? "is-pending" : ""}" type="button" data-action="media-toggle" aria-label="${toggleLabel}" aria-pressed="${current.playing}" aria-busy="${pendingMediaCommand === "toggle"}" ${!current.canPlayPause ? "disabled" : ""} ${commandPending ? 'aria-disabled="true"' : ""}>
        ${icon(current.playing ? "pause" : "play")}
      </button>
      <span class="sr-only" role="status" aria-live="polite">${escapeHtml(mediaCommandFeedback?.message ?? "")}</span>
    </div>`;
}

function renderCompact(): string {
  switch (content) {
    case "welcome":
      return `
        <span class="mark mark--compact">${icon("atoll")}</span>
        <span class="compact__copy">
          <strong>Atoll is ready</strong>
          <small>Click to surface controls</small>
        </span>`;
    case "media":
      return `
        ${renderCover(media, "cover cover--compact")}
        <span class="compact__copy">
          <strong>${escapeHtml(media?.title ?? "No media")}</strong>
          <small>${escapeHtml(media?.artist ?? "Waiting for a session")}</small>
        </span>
        <span class="compact__status">${icon(media?.playing ? "pause" : "play")}</span>`;
    case "volume": {
      const percentage = Math.round(volume.level * 100);
      return `
        <span class="compact__glyph">${icon(volume.muted ? "volumeMute" : "volume")}</span>
        <span class="volume__stack">
          <span class="volume__label">${volume.muted ? "Muted" : "Volume"} <strong>${percentage}%</strong></span>
          <span class="meter" role="meter" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" aria-valuetext="${volume.muted ? `Muted, ${percentage} percent` : `${percentage} percent`}"><span style="transform:scaleX(${volume.level})"></span></span>
        </span>`;
    }
    case "timer":
      return `
        <span class="compact__glyph compact__glyph--timer">${icon("timer")}</span>
        <span class="compact__copy">
          <strong>Focus</strong>
          <small>${timer.phase === "paused" ? "Paused" : "In progress"}</small>
        </span>
        <time class="compact__time">${formatDuration(remainingMs(timer))}</time>`;
    case "timer-finished":
      return `
        <span class="compact__glyph compact__glyph--finished">${icon("timer")}</span>
        <span class="compact__copy">
          <strong>Time’s up</strong>
          <small>Focus session complete</small>
        </span>
        <span class="compact__status compact__status--finished">${icon("check")}</span>`;
    default:
      return `
        <span class="mark mark--compact">${icon("atoll")}</span>
        <span class="compact__copy"><strong>Atoll</strong><small>Your status, surfaced.</small></span>`;
  }
}

function renderExpanded(): string {
  switch (expandedPanel) {
    case "media":
      return renderMediaPanel();
    case "timer":
      return renderTimerPanel();
    case "timer-finished":
      return renderTimerFinishedPanel();
    case "settings":
      return renderSettingsPanel();
    default:
      return renderHomePanel();
  }
}

function renderHomePanel(): string {
  const emptyMedia = mediaEmptyCopy();
  return `
    <header class="expanded__header">
      <button class="brand-lockup" type="button" data-action="collapse" aria-label="Collapse Atoll">
        <span class="mark">${icon("atoll")}</span>
        <span><strong>Atoll</strong><small>${homeStatusLine()}</small></span>
      </button>
      ${renderInlineVolume()}
      <button class="icon-button" type="button" data-action="open-settings" aria-label="Open settings">${icon("gear")}</button>
    </header>
    <div class="home__media ${media ? "" : "is-empty"}">
      ${renderCover(media, "cover cover--home")}
      <button class="media-summary" type="button" data-action="open-media" ${media ? "" : "disabled"}>
        <strong>${escapeHtml(media?.title ?? emptyMedia.title)}</strong>
        <small>${escapeHtml(media?.artist ?? emptyMedia.detail)}</small>
      </button>
      ${
        media
          ? `<button class="icon-button icon-button--accent" type="button" data-action="media-toggle" aria-label="${media.playing ? "Pause" : "Play"}" ${media.canPlayPause ? "" : "disabled"} ${pendingMediaCommand !== null ? 'aria-disabled="true"' : ""}>${icon(media.playing ? "pause" : "play")}</button>`
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

function renderMediaPanel(): string {
  if (!media) return renderMediaEmptyPanel();
  const current = media;
  const sourceDetail =
    mediaConnection.sessionCount > 1
      ? `${current.source} · ${mediaConnection.sessionCount} players`
      : current.source;
  const hasProgress =
    current.positionMs !== undefined &&
    current.durationMs !== undefined &&
    current.durationMs > 0;
  const commandPending = pendingMediaCommand !== null;
  const sourceCopy = mediaCommandFeedback?.message ?? sourceDetail;
  const footerContent =
    !mediaCommandFeedback && Date.now() < volumeVisibleUntil
      ? renderInlineVolume()
      : `<span class="source-label ${mediaCommandFeedback?.failed ? "source-label--feedback" : ""}" aria-live="${mediaCommandFeedback ? "polite" : "off"}"><span class="source-label__dot" aria-hidden="true"></span><span>${escapeHtml(sourceCopy)}</span></span>`;
  return `
    <header class="expanded__header expanded__header--media">
      ${renderCover(current, "cover cover--expanded")}
      <button class="media-title" type="button" data-action="collapse" aria-label="Collapse Atoll" title="${escapeAttribute(`${current.title} — ${current.artist}`)}">
        <strong>${escapeHtml(current.title)}</strong>
        <small>${escapeHtml(current.artist)}</small>
      </button>
      <button class="icon-button" type="button" data-action="open-settings" aria-label="Open settings">${icon("gear")}</button>
    </header>
    <div class="media-playback ${hasProgress ? "" : "media-playback--without-progress"}">
      ${renderMediaProgress(current)}
      <div class="media-controls" role="group" aria-label="Media controls" aria-busy="${commandPending}">
        ${mediaButton("media-previous", "previous", "Previous", current.canPrevious, false, commandPending)}
        ${mediaButton("media-toggle", current.playing ? "pause" : "play", current.playing ? "Pause" : "Play", current.canPlayPause, true, commandPending, pendingMediaCommand === "toggle")}
        ${mediaButton("media-next", "next", "Next", current.canNext, false, commandPending)}
      </div>
    </div>
    <footer class="expanded__footer">
      ${footerContent}
    </footer>`;
}

function renderMediaEmptyPanel(): string {
  const empty = mediaEmptyCopy();
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
      <span>${mediaConnection.sessionCount > 0 ? `${mediaConnection.sessionCount} player connected` : "QQ Music · Spotify · browsers"}</span>
      <button class="text-button" type="button" data-action="open-home">${icon("back")}Home</button>
    </footer>`;
}

function renderTimerPanel(): string {
  const time = formatDuration(remainingMs(timer));
  return `
    <header class="timer-hero">
      <button class="mark mark--button" type="button" data-action="collapse" aria-label="Collapse Atoll">${icon("timer")}</button>
      <span class="timer-hero__copy"><small>${timer.phase === "paused" ? "Focus paused" : "Focus timer"}</small><time>${time}</time></span>
      <span class="timer-hero__status">${timer.phase === "paused" ? "Paused" : "Running"}</span>
    </header>
    <div class="timer-actions">
      <button class="control-button control-button--primary" type="button" data-action="toggle-timer">
        ${icon(timer.phase === "running" ? "pause" : "play")}
        ${timer.phase === "running" ? "Pause" : "Continue"}
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

function renderSettingsPanel(): string {
  return `
    <header class="expanded__header settings__header">
      <button class="icon-button" type="button" data-action="open-home" aria-label="Back to Atoll home">${icon("back")}</button>
      <span class="settings__title"><strong>Settings</strong><small>Changes apply immediately</small></span>
      <button class="text-button" type="button" data-action="reset-settings">Reset</button>
    </header>
    <div class="settings__rows">
      ${settingToggle("Motion", "Smooth state changes", "animationsEnabled", settings.animationsEnabled)}
      ${settingToggle("Full screen", "Hide Atoll automatically", "hideInFullscreen", settings.hideInFullscreen)}
      <div class="setting-row">
        <span><strong>Idle</strong><small>When nothing needs attention</small></span>
        <div class="segmented" role="group" aria-label="Idle behavior">
          <button type="button" data-action="set-idle" data-value="reef" class="${settings.idleMode === "reef" ? "is-active" : ""}" aria-pressed="${settings.idleMode === "reef"}">Reef</button>
          <button type="button" data-action="set-idle" data-value="hidden" class="${settings.idleMode === "hidden" ? "is-active" : ""}" aria-pressed="${settings.idleMode === "hidden"}">Hidden</button>
        </div>
      </div>
    </div>`;
}

function settingToggle(
  title: string,
  detail: string,
  settingName: keyof AtollSettings,
  checked: boolean,
): string {
  return `
    <button class="setting-row" type="button" role="switch" aria-checked="${checked}" data-action="toggle-setting" data-value="${settingName}">
      <span><strong>${title}</strong><small>${detail}</small></span>
      <span class="switch ${checked ? "is-on" : ""}" aria-hidden="true"><span></span></span>
    </button>`;
}

function mediaButton(
  action: string,
  iconName: "previous" | "play" | "pause" | "next",
  label: string,
  enabled: boolean,
  primary = false,
  commandPending = false,
  isPending = false,
): string {
  return `
    <button class="media-button ${primary ? "media-button--primary" : ""} ${isPending ? "is-pending" : ""}" type="button" data-action="${action}" aria-label="${isPending ? `${label}, working` : label}" aria-busy="${isPending}" ${enabled ? "" : "disabled"} ${commandPending ? 'aria-disabled="true"' : ""}>
      ${icon(iconName)}
    </button>`;
}

function renderMediaProgress(current: MediaStatus): string {
  if (current.positionMs === undefined || current.durationMs === undefined || current.durationMs <= 0) {
    return "";
  }
  const position = mediaPositionMs(current);
  const ratio = Math.min(1, Math.max(0, position / current.durationMs));
  const elapsedSeconds = Math.floor(position / 1000);
  const durationSeconds = Math.floor(current.durationMs / 1000);
  return `
    <div class="media-progress">
      <span class="media-progress__track" role="progressbar" aria-label="Playback progress" aria-valuemin="0" aria-valuemax="${durationSeconds}" aria-valuenow="${elapsedSeconds}" aria-valuetext="${formatPlaybackTime(position)} of ${formatPlaybackTime(current.durationMs)}">
        <span class="media-progress__fill" data-media-progress style="transform:scaleX(${ratio})"></span>
      </span>
      <span class="media-progress__time" aria-hidden="true"><span data-media-elapsed>${formatPlaybackTime(position)}</span><span>${formatPlaybackTime(current.durationMs)}</span></span>
    </div>`;
}

function timerPresetButton(minutes: number): string {
  return `<button type="button" data-action="start-timer" data-value="${minutes}">${minutes} min</button>`;
}

function renderCover(current: MediaStatus | null, className: string): string {
  const artwork = current?.artworkDataUrl;
  if (artwork?.startsWith("data:image/")) {
    return `<span class="${className} cover--image" style="background-image:url('${escapeAttribute(artwork)}')" role="img" aria-label="Album artwork for ${escapeHtml(current?.title ?? "current media")}"></span>`;
  }
  return `<span class="${className} cover--brand" aria-hidden="true">${icon("atoll")}</span>`;
}

function renderInlineVolume(): string {
  if (Date.now() >= volumeVisibleUntil) return "";
  const percentage = Math.round(volume.level * 100);
  return `<span class="inline-volume" role="meter" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" aria-valuetext="${volume.muted ? `Muted, ${percentage} percent` : `${percentage} percent`}">${icon(volume.muted ? "volumeMute" : "volume")}<span class="inline-volume__track" aria-hidden="true"><span style="transform:scaleX(${volume.level})"></span></span><b>${percentage}</b></span>`;
}

function compactAccessibleLabel(): string {
  const expand = "Expand Atoll";
  switch (content) {
    case "welcome":
      return `Atoll is ready. ${expand}`;
    case "media": {
      const title = media?.title ?? "No active media";
      const artist = media?.artist ? ` by ${media.artist}` : "";
      const playback = media ? (media.playing ? "playing" : "paused") : "waiting for a session";
      return `${title}${artist}, ${playback}. ${expand}`;
    }
    case "volume": {
      const percentage = Math.round(volume.level * 100);
      return `${volume.muted ? "Muted" : `Volume ${percentage} percent`}. ${expand}`;
    }
    case "timer":
      return `Focus timer, ${formatDuration(remainingMs(timer))} remaining, ${timer.phase === "paused" ? "paused" : "running"}. ${expand}`;
    case "timer-finished":
      return `Focus timer complete. ${expand}`;
    default:
      return `Atoll. ${expand}`;
  }
}

function homeStatusLine(): string {
  if (timer.phase === "running") return `${formatDuration(remainingMs(timer))} remaining`;
  if (media?.playing) return "Media is playing";
  return "Your status, surfaced.";
}

function mediaEmptyCopy(): { title: string; detail: string } {
  switch (mediaConnection.status) {
    case "checking":
      return {
        title: "Checking Windows media…",
        detail: "Looking for connected players",
      };
    case "metadata_unavailable":
      return {
        title: "Player connected",
        detail: "It isn’t sharing track details with Windows",
      };
    case "unavailable":
      return {
        title: "Media controls unavailable",
        detail: "Atoll couldn’t reach Windows media sessions",
      };
    default:
      return {
        title: "No active media",
        detail: "Start playback in QQ Music or another player",
      };
  }
}

function playTimerTone(): void {
  if (!settings.soundsEnabled) return;
  try {
    const AudioContextCtor = window.AudioContext;
    const context = new AudioContextCtor();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    gain.connect(context.destination);
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.1);
      oscillator.stop(context.currentTime + 0.38);
    });
    window.setTimeout(() => void context.close(), 600);
  } catch {
    // Sound is optional and must never interrupt the timer state.
  }
}

function persistTimer(): void {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
  } catch {
    // A storage failure must not stop an active timer.
  }
  syncNativeTimer();
}

function syncNativeTimer(): void {
  if (!nativeRuntime || previewMode) return;
  const endAtMs =
    timer.phase === "running" && timer.endAt !== null ? Math.ceil(timer.endAt) : null;
  void invoke("schedule_timer", {
    endAtMs,
    breakFullscreen: settings.timerBreaksFullscreen,
  }).catch((error: unknown) => console.warn("Unable to schedule the native timer", error));
}

function loadTimer(): TimerStatus {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return { ...EMPTY_TIMER };
    const parsed = JSON.parse(raw) as Partial<TimerStatus>;
    if (!["idle", "running", "paused", "finished"].includes(parsed.phase ?? "")) {
      return { ...EMPTY_TIMER };
    }
    return reconcileTimer({
      phase: parsed.phase as TimerStatus["phase"],
      durationMs: validNumber(parsed.durationMs),
      endAt: parsed.endAt === null ? null : validNumber(parsed.endAt),
      pausedRemainingMs:
        parsed.pausedRemainingMs === null ? null : validNumber(parsed.pausedRemainingMs),
    });
  } catch {
    return { ...EMPTY_TIMER };
  }
}

function validNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
