import type { AppViewModel, ExpandedPanel, PreviewMode } from "./app/types";
import { consumeFirstRun, loadSettings, saveSettings } from "./config";
import {
  DEMO_MEDIA,
  normalizeMedia,
  type ContentKind,
  type MediaConnection,
  type MediaStatus,
  type NativeMediaPayload,
  type NativeMediaUpdatePayload,
  type NativeVolumePayload,
  type ShellState,
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
import { copyFor, normalizeLanguage } from "./i18n";
import {
  applyNativeShell,
  getFullscreen,
  getMediaStatus,
  nativeRuntime,
  runNativeMediaCommand,
  setNativeMenuLanguage,
  showNativeContextMenu,
  subscribeNativeEvents,
  type NativeShellSettledPayload,
} from "./platform/native";
import { IslandMaterialFlow, type MaterialPulse } from "./material/flow";
import { SHELL_GEOMETRY } from "./shell/geometry";
import { renderApp, updateMediaProgress } from "./ui/render";
import "./styles.css";

interface NativeAcceptedShell {
  shell: ShellState;
  signature: string;
}

interface PendingShellPresentation {
  revision: number;
  previous: ShellState;
  next: Exclude<ShellState, "hidden">;
  animated: boolean;
  pendingPulse: MaterialPulse | null;
}

const appElement = document.querySelector<HTMLElement>("#app");
if (!appElement) throw new Error("Atoll root element was not found.");
const app: HTMLElement = appElement;
const materialLayer = document.querySelector<HTMLElement>("#material-layer");
const materialCanvas = document.querySelector<HTMLCanvasElement>("#material-flow");
if (!materialLayer || !materialCanvas) {
  throw new Error("Atoll material layer was not found.");
}
const materialFlow = new IslandMaterialFlow(materialLayer, materialCanvas);

const requestedPreviewMode = new URLSearchParams(location.search).get("preview");
const previewMode =
  import.meta.env.DEV && isPreviewMode(requestedPreviewMode) ? requestedPreviewMode : null;
document.documentElement.classList.toggle("native-runtime", nativeRuntime);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const lightColorScheme = window.matchMedia("(prefers-color-scheme: light)");

let settings = loadSettings();
document.documentElement.lang = settings.language;
let shell: ShellState = "hidden";
let lastVisibleShell: Exclude<ShellState, "hidden"> = "reef";
let content: ContentKind = "idle";
let expandedPanel: ExpandedPanel = "home";
let media: MediaStatus | null = null;
let mediaConnection: MediaConnection = { status: "checking", sessionCount: 0 };
let volume: VolumeStatus = { level: 0, muted: false };
let fullscreen = false;
let fullscreenOverride = false;
let demoOverride: ContentKind | null = null;
let transientExpiryId: number | null = null;
let expandedExpiryId: number | null = null;
let expandedExpiryDeadline = 0;
let expandedSessionRevision = 0;
let mediaProgressTickId: number | null = null;
let volumeVisibleUntil = 0;
let lastMediaIdentity = "";
let mediaEventsReady = false;
let pendingMediaCommand: MediaCommand | null = null;
let mediaCommandFeedback: MediaCommandFeedback | null = null;
let mediaCommandFeedbackId: number | null = null;
let firstRun = previewMode ? false : consumeFirstRun();
let animateNextShellContent = false;
let shellTransitionResetId: number | null = null;
let manuallyHidden = false;
let shellRevision = 0;
let nativeAcceptedShell: NativeAcceptedShell | null = null;
let nativeShellQueue: Promise<void> = Promise.resolve();
let nativeEventBridgeReady = false;
let pendingShellPresentation: PendingShellPresentation | null = null;
let shellPresentationSafetyId: number | null = null;

function isPreviewMode(value: string | null): value is PreviewMode {
  return (
    value === "reef" ||
    value === "compact-media" ||
    value === "expanded-home" ||
    value === "expanded-media" ||
    value === "settings"
  );
}

app.addEventListener("click", onClick);
app.addEventListener("contextmenu", onContextMenu);
app.addEventListener("pointerdown", onExpandedActivity);
app.addEventListener("wheel", onExpandedActivity, { passive: true });
window.addEventListener("keydown", onKeyDown);
reducedMotion.addEventListener("change", () => {
  render();
});
lightColorScheme.addEventListener("change", () => {
  nativeAcceptedShell = null;
  if (nativeRuntime && shell !== "hidden") {
    void setShell(shell, false, true);
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !previewMode) {
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
    await setNativeMenuLanguage(settings.language).catch((error: unknown) =>
      console.warn("Unable to update the Atoll menu language", error),
    );
    const subscriptions = await subscribeNativeEvents({
      onAction: applyExternalAction,
      onMediaUpdate: updateMediaConnect,
      onVolume: updateVolume,
      onFullscreenChanged: (payload) => {
        fullscreen = payload.fullscreen;
        if (!fullscreen) fullscreenOverride = false;
        reconcilePresentation();
      },
      onShellSettled: releaseNativeShellPresentation,
    }).catch((error: unknown) => {
      console.warn("Atoll event bridge unavailable", error);
      return null;
    });
    nativeEventBridgeReady = subscriptions !== null;
  }
  if (shouldHideForFullscreen()) {
    await setShell("hidden", false);
  } else if (firstRun) {
    content = "welcome";
    await setShell("compact", false);
    setTransientExpiry(4200);
  } else {
    reconcilePresentation(false);
  }
  if (!nativeRuntime) return;
  const initialMedia = await getMediaStatus().catch((error: unknown) => {
    console.warn("Unable to read the initial media state", error);
    return null;
  });
  if (initialMedia) updateMediaConnect(initialMedia);
  mediaEventsReady = true;
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
    case "expanded-home":
      content = "media";
      expandedPanel = "home";
      previewShell = "expanded";
      break;
    case "expanded-media":
      content = "media";
      expandedPanel = "media";
      previewShell = "expanded";
      break;
    case "settings":
      content = "settings";
      expandedPanel = "settings";
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
    expandedPanel = preferredExpandedPanel();
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
      content = "media";
      expandedPanel = "media";
      await setShell("expanded");
      break;
    case "open-settings":
      expandedPanel = "settings";
      content = "settings";
      await setShell("expanded");
      break;
    case "media-previous":
    case "media-toggle":
    case "media-next":
      await sendMediaCommand(action.replace("media-", "") as MediaCommand);
      break;
    case "toggle-setting":
      toggleSetting(value);
      break;
    case "set-language":
      settings = { ...settings, language: normalizeLanguage(value) };
      saveSettings(settings);
      document.documentElement.lang = settings.language;
      if (nativeRuntime) {
        await setNativeMenuLanguage(settings.language).catch((error: unknown) =>
          console.warn("Unable to update the Atoll menu language", error),
        );
      }
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
        expandedPanel = preferredExpandedPanel();
        void setShell("expanded");
      }
      break;
    case "show":
    case "expand":
    case "single-instance":
      manuallyHidden = false;
      if (fullscreen) fullscreenOverride = true;
      expandedPanel = preferredExpandedPanel();
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
  if (next && trackChanged && (fromDemo || mediaEventsReady)) {
    surfaceEvent("media");
  } else {
    reconcilePresentation();
  }
  mediaEventsReady = true;
}

function surfaceEvent(panel: ExpandedPanel): void {
  if (manuallyHidden || shouldHideForFullscreen()) {
    reconcilePresentation();
    return;
  }
  if (shell === "expanded") {
    // Settings is an intentional user task; media or volume updates should not
    // pull focus away from it. Every other expanded surface follows the event
    // that woke it, so a new track visibly reaches the Review v2 media card.
    if (expandedPanel !== "settings") expandedPanel = panel;
    queueMaterialPulse(panel === "media" ? "media" : "volume");
    resetExpandedExpiry();
    render();
    return;
  }
  expandedPanel = panel;
  void setShell("expanded");
}

function updateVolume(payload: NativeVolumePayload): void {
  volume = {
    level: Math.min(1, Math.max(0, payload.level)),
    muted: payload.muted,
  };
  if (payload.initial) return;
  volumeVisibleUntil = Date.now() + 1800;
  surfaceEvent("home");
  scheduleVisibleTransientExpiry();
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
  updateMediaProgress(app, media, settings.language);
}

function reconcilePresentation(
  animate = !reducedMotion.matches,
  preserveExpanded = true,
): void {
  if (manuallyHidden) {
    void setShell("hidden", animate);
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
  } else if (firstRun) {
    content = "welcome";
  } else {
    content = "idle";
  }

  if (preserveExpanded && shell === "expanded") {
    render();
  } else if (content === "idle") {
    void setShell("reef", animate);
  } else {
    void setShell("compact", animate);
  }
}

function shouldHideForFullscreen(): boolean {
  return fullscreen && !fullscreenOverride && settings.hideInFullscreen;
}

function collapse(): void {
  clearExpandedExpiry();
  if (content === "settings") content = "idle";
  reconcilePresentation(!reducedMotion.matches, false);
}

function setGeometryPending(pending: boolean): void {
  if (pending) {
    app.dataset.geometryPending = "";
  } else {
    delete app.dataset.geometryPending;
  }
}

function clearPendingShellPresentation(): void {
  if (shellPresentationSafetyId !== null) {
    window.clearTimeout(shellPresentationSafetyId);
    shellPresentationSafetyId = null;
  }
  pendingShellPresentation = null;
  setGeometryPending(false);
}

function queueMaterialPulse(kind: MaterialPulse): void {
  const pending = pendingShellPresentation;
  if (pending && pending.revision === shellRevision && pending.next === "expanded") {
    pending.pendingPulse = kind;
    return;
  }
  materialFlow.pulse(kind);
}

function releaseNativeShellPresentation(payload: NativeShellSettledPayload): void {
  const pending = pendingShellPresentation;
  if (
    !pending ||
    pending.revision !== payload.transitionId ||
    pending.revision !== shellRevision ||
    pending.next !== shell
  ) {
    return;
  }

  clearPendingShellPresentation();
  animateNextShellContent = pending.animated && pending.previous !== pending.next;
  setShellTransition(pending.previous, pending.next, animateNextShellContent);
  render();
  if (pending.pendingPulse) materialFlow.pulse(pending.pendingPulse);
}

async function setShell(
  next: ShellState,
  animated = !reducedMotion.matches,
  forceNative = false,
): Promise<void> {
  const previous = shell;
  const enteredExpanded = previous !== "expanded" && next === "expanded";
  if (next !== "expanded") clearExpandedExpiry();
  if (previous !== next || forceNative) shellRevision += 1;
  const revision = shellRevision;
  clearPendingShellPresentation();
  const shouldGatePresentation =
    nativeRuntime && nativeEventBridgeReady && next !== "hidden" && previous !== next;
  animateNextShellContent = animated && previous !== next && !shouldGatePresentation;
  if (shouldGatePresentation) {
    pendingShellPresentation = {
      revision,
      previous,
      next,
      animated,
      pendingPulse: enteredExpanded && animated ? "expand" : null,
    };
    setGeometryPending(true);
    // This is only a failure guard for an unavailable native event bridge, not
    // the animation clock. Normal presentation is released by the matching
    // native transition-id event immediately after its final geometry frame.
    shellPresentationSafetyId = window.setTimeout(() => {
      releaseNativeShellPresentation({ transitionId: revision });
    }, 1200);
  } else {
    setShellTransition(previous, next, animateNextShellContent);
    if (enteredExpanded && animated) materialFlow.pulse("expand");
  }
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
          transitionId: revision,
        });
        nativeAcceptedShell = { shell: next, signature };
        return;
      } catch (error: unknown) {
        lastError = error;
        if (revision !== shellRevision) return;
      }
    }

    console.warn("Unable to update the Atoll shell after retrying", lastError);
    releaseNativeShellPresentation({ transitionId: revision });
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

function setShellTransition(
  previous: ShellState,
  next: ShellState,
  animated: boolean,
): void {
  if (shellTransitionResetId !== null) {
    window.clearTimeout(shellTransitionResetId);
    shellTransitionResetId = null;
  }

  // Keep directional presentation state short-lived so ordinary metadata
  // updates never replay a shell entrance motion.
  const transition = !animated
    ? ""
    : previous === "compact" && next === "expanded"
      ? "compact-expanded"
      : previous === "reef" && next === "expanded"
        ? "reef-expanded"
        : previous === "expanded" && (next === "reef" || next === "compact")
          ? "expanded-collapse"
          : "";
  if (!transition) {
    delete app.dataset.transition;
    return;
  }

  app.dataset.transition = transition;
  shellTransitionResetId = window.setTimeout(() => {
    delete app.dataset.transition;
    shellTransitionResetId = null;
  }, 320);
}

function setTransientExpiry(milliseconds: number): void {
  clearTransientExpiry();
  transientExpiryId = window.setTimeout(() => {
    transientExpiryId = null;
    firstRun = false;
    demoOverride = demoOverride === "volume" ? null : demoOverride;
    reconcilePresentation();
    scheduleVisibleTransientExpiry();
  }, milliseconds);
}

function clearTransientExpiry(): void {
  if (transientExpiryId === null) return;
  window.clearTimeout(transientExpiryId);
  transientExpiryId = null;
}

function scheduleVisibleTransientExpiry(): void {
  clearTransientExpiry();
  const now = Date.now();
  const deadline = now < volumeVisibleUntil ? volumeVisibleUntil : 0;
  if (deadline > now) setTransientExpiry(deadline - now);
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
  queueMaterialPulse("control");

  if (!nativeRuntime || demoOverride === "media") {
    if (command === "toggle") media = optimisticPlaybackToggle(current);
    render();
    return;
  }

  const sessionRevision = current.sessionRevision;
  const identity = mediaIdentityFor(current);
  const previousPlaying = current.playing;
  pendingMediaCommand = command;
  setMediaCommandFeedback(commandPendingMessage(command, current, settings.language), false);
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
    setMediaCommandFeedback(copyFor(settings.language).media.controlUnavailable, true, 1600);
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
  if (settingName !== "hideInFullscreen") return;
  settings = { ...settings, hideInFullscreen: !settings.hideInFullscreen };
  saveSettings(settings);
  reconcilePresentation();
}

function panelForContent(kind: ContentKind): ExpandedPanel {
  if (kind === "media") return "media";
  if (kind === "settings") return "settings";
  return "home";
}

function preferredExpandedPanel(): ExpandedPanel {
  return media ? "media" : "home";
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
    settings,
    pendingMediaCommand,
    mediaCommandFeedback,
    showInlineVolume: now < volumeVisibleUntil,
    animateContent: animateNextShellContent,
    motionDisabled: reducedMotion.matches,
    now,
  };
  animateNextShellContent = false;
  renderApp(app, vm);
  const geometry = shell === "hidden" ? SHELL_GEOMETRY[lastVisibleShell] : SHELL_GEOMETRY[shell];
  materialFlow.sync({
    shell,
    cornerRadius: geometry.cornerRadius,
    motionDisabled: reducedMotion.matches,
    lightTheme: lightColorScheme.matches,
  });
  scheduleMediaProgressTick();
}
