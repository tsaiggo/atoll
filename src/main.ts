import type { AppViewModel, ExpandedPanel, PreviewMode } from "./app/types";
import { consumeFirstRun, loadSettings, resetSettings, saveSettings } from "./config";
import {
  createTimer,
  DEMO_MEDIA,
  EMPTY_TIMER,
  normalizeMedia,
  pauseTimer,
  reconcileTimer,
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
import {
  commandPendingMessage,
  mediaCommandEnabled,
  mediaIdentityFor,
  optimisticPlaybackToggle,
  type MediaCommand,
  type MediaCommandFeedback,
} from "./features/media/commands";
import { loadTimer, saveTimer } from "./features/timer/storage";
import {
  applyNativeShell,
  getFullscreen,
  getMediaStatus,
  nativeRuntime,
  runNativeMediaCommand,
  scheduleNativeTimer,
  showNativeContextMenu,
  subscribeNativeEvents,
} from "./platform/native";
import { SHELL_GEOMETRY } from "./shell/geometry";
import { renderApp, updateMediaProgress } from "./ui/render";
import "./styles.css";

interface NativeAcceptedShell {
  shell: ShellState;
  signature: string;
}

const appElement = document.querySelector<HTMLElement>("#app");
if (!appElement) throw new Error("Atoll root element was not found.");
const app: HTMLElement = appElement;

const requestedPreviewMode = new URLSearchParams(location.search).get("preview");
const previewMode =
  import.meta.env.DEV && isPreviewMode(requestedPreviewMode) ? requestedPreviewMode : null;
document.documentElement.classList.toggle("native-runtime", nativeRuntime);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const lightColorScheme = window.matchMedia("(prefers-color-scheme: light)");

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
    fullscreen = await getFullscreen().catch(() => false);
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
  await subscribeNativeEvents({
    onAction: applyExternalAction,
    onMediaUpdate: updateMediaConnect,
    onVolume: updateVolume,
    onTimerElapsed: () => {
      if (timer.phase !== "running") return;
      timer = reconcileTimer(timer);
      if (timer.phase !== "finished") {
        timer = { ...timer, phase: "finished", endAt: null, pausedRemainingMs: 0 };
      }
      finishTimer();
    },
    onFullscreenChanged: (payload) => {
      fullscreen = payload.fullscreen;
      if (!fullscreen) fullscreenOverride = false;
      reconcilePresentation();
    },
  }).catch((error: unknown) => console.warn("Atoll event bridge unavailable", error));
  const initialMedia = await getMediaStatus().catch((error: unknown) => {
    console.warn("Unable to read the initial media state", error);
    return null;
  });
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
    void showNativeContextMenu().catch((error: unknown) =>
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
  updateMediaProgress(app, media);
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

  const geometry = next === "hidden" ? SHELL_GEOMETRY[lastVisibleShell] : SHELL_GEOMETRY[next];
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
        await applyNativeShell({
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
    accepted = await runNativeMediaCommand(command, sessionRevision);
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
  const now = Date.now();
  const vm: AppViewModel = {
    shell,
    content,
    expandedPanel,
    media,
    mediaConnection,
    volume,
    timer,
    settings,
    pendingMediaCommand,
    mediaCommandFeedback,
    showInlineVolume: now < volumeVisibleUntil,
    animateContent: animateNextShellContent,
    motionDisabled: !settings.animationsEnabled || reducedMotion.matches,
    now,
  };
  animateNextShellContent = false;
  renderApp(app, vm);
  scheduleMediaProgressTick();
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
  saveTimer(timer);
  syncNativeTimer();
}

function syncNativeTimer(): void {
  if (!nativeRuntime || previewMode) return;
  const endAtMs =
    timer.phase === "running" && timer.endAt !== null ? Math.ceil(timer.endAt) : null;
  void scheduleNativeTimer(endAtMs, settings.timerBreaksFullscreen).catch((error: unknown) =>
    console.warn("Unable to schedule the native timer", error),
  );
}
