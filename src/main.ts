import type { AppViewModel, ExpandedPanel, PreviewMode } from "./app/types";
import {
  consumeFirstRun,
  EXPANDED_AUTO_COLLAPSE_MS,
  loadSettings,
  saveSettings,
} from "./config";
import {
  DEMO_CODEX_USAGE,
  DEMO_ENERGY,
  DEMO_MEDIA,
  DEMO_MEDIA_SOURCES,
  codexUsageSignalKey,
  codexUsageTransition,
  formatPlaybackTime,
  normalizeCodexUsage,
  normalizeEnergy,
  normalizeMedia,
  normalizeMediaSourceSelection,
  normalizeMediaSources,
  type ContentKind,
  type CodexUsageStatus,
  type EnergyStatus,
  type MediaConnection,
  type MediaSource,
  type MediaStatus,
  type NativeMediaPayload,
  type NativeMediaUpdatePayload,
  type NativeCodexUsagePayload,
  type NativeEnergyPayload,
  type NativeVolumePayload,
  type ShellState,
  type VolumeStatus,
} from "./domain";
import {
  commandPendingMessage,
  mediaCommandEnabled,
  mediaIdentityFor,
  normalizeMediaSeekPosition,
  optimisticMediaSeek,
  optimisticPlaybackToggle,
  type MediaCommand,
  type MediaCommandFeedback,
} from "./features/media/commands";
import { copyFor, normalizeLanguage } from "./i18n";
import {
  applyNativeShell,
  getCodexUsageStatus,
  getEnergyStatus,
  getFullscreen,
  getMediaStatus,
  nativeRuntime,
  refreshNativeCodexUsage,
  runNativeMediaCommand,
  runNativeMediaSeek,
  selectNativeMediaSource,
  setNativeSystemMute,
  setNativeSystemVolume,
  setNativeMenuLanguage,
  setNativeCodexUsageEnabled,
  showNativeContextMenu,
  subscribeNativeEvents,
} from "./platform/native";
import { isNotchEdge, type NotchGeometry, type NotchEdge } from "./shell/geometry";
import { renderApp, updateMediaProgress } from "./ui/render";
import "./styles.css";

interface NativeAcceptedShell {
  shell: ShellState;
  signature: string;
}



interface PendingMediaSeek {
  readonly identity: string;
  readonly positionMs: number;
  readonly sessionRevision: number;
}

const appElement = document.querySelector<HTMLElement>("#app");
if (!appElement) throw new Error("Atoll root element was not found.");
const app: HTMLElement = appElement;

const requestedPreviewMode = new URLSearchParams(location.search).get("preview");
const previewMode =
  import.meta.env.DEV && isPreviewMode(requestedPreviewMode) ? requestedPreviewMode : null;
document.documentElement.classList.toggle("native-runtime", nativeRuntime);
if (previewMode) document.documentElement.dataset.preview = previewMode;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const lightColorScheme = window.matchMedia("(prefers-color-scheme: light)");

let settings = loadSettings();
const previewEdge = new URLSearchParams(location.search).get("edge");
if (previewMode && isNotchEdge(previewEdge)) settings = { ...settings, notchEdge: previewEdge };
let pointerInside = false;
let keyboardNavigation = false;
let suppressNotchMotion = false;
let volumeEditing = false;
let deferredRender = false;
let notchPinned = false;
let notchHoverId: number | null = null;
let notchLeaveId: number | null = null;
document.documentElement.lang = settings.language;
let shell: ShellState = "hidden";

let content: ContentKind = "idle";
let expandedPanel: ExpandedPanel = "home";
let media: MediaStatus | null = null;
let mediaConnection: MediaConnection = {
  status: "checking",
  sessionCount: 0,
  sources: [],
  manualSource: null,
};
let volume: VolumeStatus = { level: 0, muted: false };
let energy: EnergyStatus = {
  available: false,
  todayMwh: 0,
  dayKey: "",
  trackingSinceMs: 0,
  partial: false,
  history: [],
  source: "battery_discharge",
};
let codexUsage: CodexUsageStatus = {
  enabled: settings.codexUsageEnabled,
  status: settings.codexUsageEnabled ? "checking" : "disabled",
  windows: [],
  dailyUsage: [],
  activityAvailable: false,
  updatedAtMs: null,
  source: "codex_app_server",
};
let selectedEnergyDayKey: string | null = null;
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
let pendingMediaSeek: PendingMediaSeek | null = null;
let mediaSeekCommitId: number | null = null;
let mediaSeekEditing = false;
let restoreMediaSeekFocus = false;
let pendingSourceSelection = false;
let pendingCodexUsageAction: "enable" | "disable" | "refresh" | null = null;
let codexUsageTickId: number | null = null;
let codexUsageActivationPending = false;
const surfacedCodexUsageSignals = new Set<string>();
let volumeCommandRevision = 0;
let mediaCommandFeedback: MediaCommandFeedback | null = null;
let mediaCommandFeedbackId: number | null = null;
let firstRun = previewMode ? false : consumeFirstRun();
let animateNextShellContent = false;
let shellTransitionResetId: number | null = null;
let manuallyHidden = false;
let shellRevision = 0;
let nativeAcceptedShell: NativeAcceptedShell | null = null;






function isPreviewMode(value: string | null): value is PreviewMode {
  return (
    value === "reef" ||
    value === "compact-media" ||
    value === "expanded-home" ||
    value === "expanded-media" ||
    value === "expanded-volume" ||
    value === "expanded-energy" ||
    value === "expanded-codex" ||
    value === "expanded-sources" ||
    value === "settings"
  );
}

app.addEventListener("click", onClick);
app.addEventListener("pointerenter", onNotchEnter);
app.addEventListener("pointerleave", onNotchLeave);
// Replacing the hovered SVG during a render can invalidate the browser's
// boundary-event target. Reconcile from the real next pointer target as well.
window.addEventListener("pointermove", (event) => {
  const inside = event.target instanceof Node && event.target !== app && app.contains(event.target);
  if (inside && !pointerInside) onNotchEnter();
  else if (!inside && pointerInside) onNotchLeave();
});
window.addEventListener("pointerout", (event) => {
  if (event.relatedTarget === null && pointerInside) onNotchLeave();
});
app.addEventListener("pointerover", onNotchHover);
app.addEventListener("focusin", onNotchFocus);
app.addEventListener("focusout", () => {
  if (!pointerInside && !notchPinned) scheduleNotchLeave();
});
app.addEventListener("contextmenu", onContextMenu);
app.addEventListener("pointerdown", () => { keyboardNavigation = false; });
app.addEventListener("pointerdown", onExpandedActivity);
window.addEventListener("pointerup", endMediaSeekEditing);
window.addEventListener("pointercancel", endMediaSeekEditing);
app.addEventListener("wheel", onExpandedActivity, { passive: true });
app.addEventListener("input", onInput);
app.addEventListener("change", onChange);
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
  scheduleCodexUsageTick();
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
    await subscribeNativeEvents({
      onAction: applyExternalAction,
      onCodexUsage: updateCodexUsage,
      onEnergy: updateEnergy,
      onMediaUpdate: updateMediaConnect,
      onVolume: updateVolume,
      onFullscreenChanged: (payload) => {
        fullscreen = payload.fullscreen;
        if (!fullscreen) fullscreenOverride = false;
        reconcilePresentation();
      },
      onShellSettled: () => {},
    }).catch((error: unknown) => {
      console.warn("Atoll event bridge unavailable", error);
      return null;
    });

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
  const initialEnergy = await getEnergyStatus().catch((error: unknown) => {
    console.warn("Unable to read the initial energy state", error);
    return null;
  });
  if (initialEnergy) updateEnergy(initialEnergy);
  if (settings.codexUsageEnabled) void startPersistedCodexUsage();
  mediaEventsReady = true;
}

function configurePreview(mode: PreviewMode): void {
  media = { ...DEMO_MEDIA };
  volume = { level: 0.68, muted: false };
  energy = { ...DEMO_ENERGY };
  codexUsage = {
    ...DEMO_CODEX_USAGE,
    windows: [...DEMO_CODEX_USAGE.windows],
    dailyUsage: [...DEMO_CODEX_USAGE.dailyUsage],
  };
  selectedEnergyDayKey = energy.dayKey;
  mediaConnection = {
    status: "ready",
    sessionCount: mode === "expanded-sources" ? 2 : 1,
    sources: mode === "expanded-sources" ? DEMO_MEDIA_SOURCES : [],
    manualSource: null,
  };
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
    case "expanded-volume":
      content = "volume";
      expandedPanel = "volume";
      previewShell = "expanded";
      break;
    case "expanded-energy":
      content = "idle";
      expandedPanel = "energy";
      previewShell = "expanded";
      break;
    case "expanded-codex":
      content = "idle";
      expandedPanel = "codex";
      previewShell = "expanded";
      break;
    case "expanded-sources":
      content = "media";
      expandedPanel = "sources";
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

function clearNotchHover(): void {
  if (notchHoverId !== null) window.clearTimeout(notchHoverId);
  notchHoverId = null;
}

function clearNotchLeave(): void {
  if (notchLeaveId !== null) window.clearTimeout(notchLeaveId);
  notchLeaveId = null;
}

function notchInteractionPending(): boolean {
  return pendingMediaCommand !== null || pendingMediaSeek !== null ||
    mediaSeekEditing || volumeEditing || pendingSourceSelection || pendingCodexUsageAction !== null;
}

function onNotchEnter(): void {
  pointerInside = true;
  clearNotchLeave();
  clearExpandedExpiry();
  if (shell === "reef") void setShell("compact");
}

function onNotchLeave(): void {
  pointerInside = false;
  clearNotchHover();
  scheduleNotchLeave();
}

function scheduleNotchLeave(): void {
  clearNotchLeave();
  if (notchPinned || shell === "hidden") return;
  notchLeaveId = window.setTimeout(() => {
    notchLeaveId = null;
    if (pointerInside || notchPinned || (keyboardNavigation && app.contains(document.activeElement))) return;
    if (notchInteractionPending()) {
      scheduleNotchLeave();
      return;
    }
    collapse();
  }, 450);
}

function panelFromValue(value: string | undefined): ExpandedPanel | null {
  return value === "media" || value === "volume" || value === "energy" ||
    value === "codex" || value === "settings" || value === "home" ? value : null;
}

function onNotchHover(event: PointerEvent): void {
  clearNotchLeave();
  const element = event.target instanceof Element ? event.target : null;
  const target = element?.closest<HTMLElement>("[data-notch-panel]");
  clearNotchHover();
  if (notchInteractionPending() || app.hasAttribute("data-geometry-pending")) return;
  if (!target) {
    if (shell === "expanded" && !notchPinned && element?.closest(".notch-rail")) {
      notchHoverId = window.setTimeout(() => {
        notchHoverId = null;
        if (pointerInside && !notchPinned && !app.querySelector(".notch-detail:hover, [data-notch-panel]:hover")) void setShell("compact");
      }, 250);
    }
    return;
  }
  const panel = panelFromValue(target.dataset.notchPanel);
  // The orb reveals its gear on hover; opening settings is an explicit click.
  if (panel === "settings") return;
  if (!panel || (shell === "expanded" && (expandedPanel === panel || (expandedPanel === "settings" && notchPinned)))) return;
  clearNotchHover();
  notchHoverId = window.setTimeout(() => {
    notchHoverId = null;
    if (pointerInside) void openNotchPanel(panel);
  }, 100);
}

function onNotchFocus(event: FocusEvent): void {
  clearNotchLeave();
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-notch-panel]") : null;
  const panel = panelFromValue(target?.dataset.notchPanel);
  if (panel && keyboardNavigation && !pointerInside && !notchInteractionPending() &&
      !(shell === "expanded" && expandedPanel === panel)) void openNotchPanel(panel);
}

async function openNotchPanel(panel: ExpandedPanel, pin = false): Promise<void> {
  clearNotchHover();
  clearNotchLeave();
  if (pin) notchPinned = true;
  if (panel === "energy" && !selectedEnergyDayKey) selectedEnergyDayKey = energy.dayKey || null;
  expandedPanel = panel;
  content = panel === "media" ? "media" : panel === "volume" ? "volume" : panel === "settings" ? "settings" : "idle";
  if (shell === "expanded") render();
  else await setShell("expanded");
}

function toggleNotchPin(): void {
  notchPinned = !notchPinned;
  if (shell === "reef") void setShell("compact");
  else render();
  if (!notchPinned && !pointerInside) scheduleNotchLeave();
}

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const actionable = target.closest<HTMLElement>("[data-action]");
  if (actionable) {
    event.stopPropagation();
    void runAction(actionable.dataset.action ?? "", actionable.dataset.value);
    return;
  }
  // Native range inputs own their pointer interaction. Letting the shell-level
  // click handler see one would make a volume adjustment collapse Atoll.
  if (target.closest<HTMLElement>("[data-control]")) {
    event.stopPropagation();
    return;
  }

  if (target.closest(".notch-detail")) return;
  toggleNotchPin();
}

function onContextMenu(event: MouseEvent): void {
  event.preventDefault();
  if (nativeRuntime) {
    void showNativeContextMenu().catch((error: unknown) =>
      console.warn("Unable to open the Atoll menu", error),
    );
  }
}

function onExpandedActivity(event?: Event): void {
  const target = event?.target;
  if (target instanceof HTMLInputElement && target.dataset.control === "media-seek") {
    mediaSeekEditing = true;
  }
  if (target instanceof HTMLInputElement && target.dataset.control === "system-volume") volumeEditing = true;
  resetExpandedExpiry();
}

function endMediaSeekEditing(event: PointerEvent): void {
  if (volumeEditing) {
    volumeEditing = false;
    window.setTimeout(() => { if (deferredRender) render(); }, 0);
  }
  const target = event.target;
  if (target instanceof HTMLInputElement && target.dataset.control === "media-seek") {
    mediaSeekEditing = false;
  }
}

function onInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.control === "system-volume") {
    volumeEditing = true;
    const level = volumeLevelFromControl(target.value);
    if (level === null) return;

    const percentage = Math.round(level * 100);
    target.style.setProperty("--volume-level", `${percentage}%`);
    target.setAttribute(
      "aria-valuetext",
      copyFor(settings.language).volume.accessibleValue(percentage, volume.muted),
    );
    target.parentElement
      ?.querySelector<HTMLOutputElement>("[data-volume-value]")
      ?.replaceChildren(String(percentage));
    resetExpandedExpiry();
    return;
  }
  if (target.dataset.control !== "media-seek") return;

  const current = media;
  const positionMs = current ? mediaSeekPositionFromControl(target, current) : null;
  if (positionMs === null || !current) return;

  mediaSeekEditing = true;
  previewMediaSeek(target, current, positionMs);
  resetExpandedExpiry();
}

function onChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.control === "system-volume") {
    volumeEditing = false;
    const level = volumeLevelFromControl(target.value);
    if (level !== null) void setSystemVolume(level);
    return;
  }
  if (target.dataset.control !== "media-seek") return;

  const current = media;
  const positionMs = current ? mediaSeekPositionFromControl(target, current) : null;
  mediaSeekEditing = false;
  if (positionMs === null || !current || pendingMediaSeek !== null) return;
  queueMediaSeek(current, positionMs, target);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Tab" || event.key.startsWith("Arrow")) keyboardNavigation = true;
  if (event.key === "Escape") keyboardNavigation = false;
  resetExpandedExpiry();
  if (event.key === "Escape" && (shell === "expanded" || shell === "compact")) {
    event.preventDefault();
    if (expandedPanel === "sources") {
      expandedPanel = "media";
      render();
    } else if (expandedPanel === "energy" || expandedPanel === "codex") {
      expandedPanel = "home";
      render();
    } else {
      collapse();
    }
  }
}

async function runAction(action: string, value?: string): Promise<void> {
  resetExpandedExpiry();
  clearNotchHover();
  switch (action) {
    case "notch-panel": {
      const panel = panelFromValue(value);
      if (panel) await openNotchPanel(panel, panel === "settings");
      if (panel === "codex" && codexUsage.enabled && pendingCodexUsageAction === null) {
        await runAction("refresh-codex-usage");
      }
      break;
    }
    case "notch-pin":
      toggleNotchPin();
      break;
    case "set-notch-edge":
      if (isNotchEdge(value)) {
        settings = { ...settings, notchEdge: value };
        notchPinned = true;
        pointerInside = false;
        saveSettings(settings);
        nativeAcceptedShell = null;
        await setShell(shell, false, true);
      }
      break;
    case "set-notch-visibility":
      if (value === "auto" || value === "always") {
        settings = { ...settings, notchVisibility: value };
        saveSettings(settings);
        render();
      }
      break;
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
    case "open-energy":
      selectedEnergyDayKey = energy.dayKey || null;
      expandedPanel = "energy";
      await setShell("expanded");
      break;
    case "open-codex":
      expandedPanel = "codex";
      await setShell("expanded");
      if (settings.codexUsageEnabled && codexUsage.status === "disabled") {
        void refreshCodexUsage();
      }
      break;
    case "enable-codex-usage":
      await setCodexUsageEnabled(true);
      break;
    case "disable-codex-usage":
      await setCodexUsageEnabled(false);
      break;
    case "refresh-codex-usage":
      await refreshCodexUsage();
      break;
    case "select-energy-day":
      if (value && hasEnergyRecordForDay(energy, value)) {
        selectedEnergyDayKey = value;
        render();
      }
      break;
    case "open-sources":
      if (mediaConnection.sources.length > 1 && !pendingSourceSelection) {
        content = "media";
        expandedPanel = "sources";
        render();
      }
      break;
    case "select-media-source":
      await selectMediaSource(value);
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
    case "toggle-volume-mute":
      await setSystemMute(!volume.muted);
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
    case "codex":
      manuallyHidden = false;
      expandedPanel = "codex";
      void setShell("expanded");
      if (settings.codexUsageEnabled && codexUsage.status === "disabled") {
        void refreshCodexUsage();
      }
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
  const sources = normalizeMediaSources(payload.sources);
  mediaConnection = {
    status,
    sessionCount,
    sources,
    manualSource: normalizeMediaSourceSelection(payload.manual_source, sources),
  };
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
  if (
    pendingMediaSeek &&
    next &&
    next.sessionRevision === pendingMediaSeek.sessionRevision &&
    mediaIdentity === pendingMediaSeek.identity
  ) {
    return;
  }
  if (
    mediaSeekEditing &&
    next &&
    media &&
    next.sessionRevision === media.sessionRevision &&
    mediaIdentity === mediaIdentityFor(media)
  ) {
    return;
  }
  if (pendingMediaSeek) cancelPendingMediaSeek();
  const trackChanged = Boolean(next && mediaIdentity !== lastMediaIdentity);
  media = next;
  lastMediaIdentity = mediaIdentity;
  if (fromDemo) {
    mediaConnection = {
      status: "ready",
      sessionCount: 1,
      sources: [],
      manualSource: null,
    };
  }
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
    // A hovered or pinned panel is an intentional task. Background changes
    // update its data without switching the detail the user is working in.
    if (!notchPinned && !pointerInside && expandedPanel !== "settings") expandedPanel = panel;
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
  surfaceEvent("volume");
  scheduleVisibleTransientExpiry();
}

function updateEnergy(payload: NativeEnergyPayload): void {
  const next = normalizeEnergy(payload);
  const changed =
    next.available !== energy.available ||
    next.todayMwh !== energy.todayMwh ||
    next.dayKey !== energy.dayKey ||
    next.trackingSinceMs !== energy.trackingSinceMs ||
    next.partial !== energy.partial ||
    !sameEnergyHistory(next.history, energy.history) ||
    next.source !== energy.source;
  if (!changed) return;
  const wasViewingCurrentDay = selectedEnergyDayKey === energy.dayKey;
  energy = next;

  if (
    selectedEnergyDayKey === null ||
    wasViewingCurrentDay ||
    !hasEnergyRecordForDay(energy, selectedEnergyDayKey)
  ) {
    selectedEnergyDayKey = energy.dayKey || null;
  }

  // Refresh the already-visible reading without opening or switching panels.
  if (shell === "expanded" || shell === "compact") {
    render();
  }
}

function updateCodexUsage(payload: NativeCodexUsagePayload): void {
  const next = normalizeCodexUsage(payload);
  const signal = codexUsageTransition(codexUsage, next);
  codexUsage = next;

  const maySynchronizeEnabledSetting =
    !codexUsageActivationPending || next.enabled || !settings.codexUsageEnabled;
  if (maySynchronizeEnabledSetting && settings.codexUsageEnabled !== next.enabled) {
    settings = { ...settings, codexUsageEnabled: next.enabled };
    saveSettings(settings);
  }

  if (signal) {
    const key = codexUsageSignalKey(signal);
    if (!surfacedCodexUsageSignals.has(key)) {
      surfacedCodexUsageSignals.add(key);
      surfaceEvent("codex");
      return;
    }
  }

  // Routine updates repaint an existing rail; they never open the notch.
  if (shell === "expanded" || shell === "compact") render();
}

async function startPersistedCodexUsage(): Promise<void> {
  if (!settings.codexUsageEnabled || !nativeRuntime || codexUsageActivationPending) return;

  codexUsageActivationPending = true;
  codexUsage = emptyCodexUsage(true, "checking");
  try {
    // The native runtime intentionally starts disabled for every process. A
    // persisted opt-in must therefore explicitly re-enable it before asking
    // for the initial snapshot.
    await setNativeCodexUsageEnabled(true);
    const initial = await getCodexUsageStatus();
    updateCodexUsage(initial);
    if (!codexUsage.enabled) codexUsage = emptyCodexUsage(true, "unavailable");
  } catch (error: unknown) {
    console.warn("Unable to start persisted Codex usage", error);
    codexUsage = emptyCodexUsage(true, "unavailable");
  } finally {
    codexUsageActivationPending = false;
    if (shell === "expanded" && expandedPanel === "codex") render();
  }
}

async function setCodexUsageEnabled(enabled: boolean): Promise<void> {
  if (
    pendingCodexUsageAction !== null ||
    (settings.codexUsageEnabled === enabled && (!enabled || codexUsage.status !== "disabled"))
  ) {
    return;
  }

  const previousSettings = settings;
  const previousUsage = codexUsage;
  pendingCodexUsageAction = enabled ? "enable" : "disable";
  if (enabled) {
    // Persist the explicit opt-in before the native runtime starts. A failed
    // startup stays opted in and surfaces an honest unavailable state rather
    // than silently erasing the user's choice.
    settings = { ...settings, codexUsageEnabled: true };
    saveSettings(settings);
    codexUsageActivationPending = true;
    codexUsage = emptyCodexUsage(true, "checking");
  } else {
    codexUsage = emptyCodexUsage(false, "disabled");
  }
  if (shell === "expanded" && expandedPanel === "codex") render();

  try {
    if (nativeRuntime) {
      await setNativeCodexUsageEnabled(enabled);
      const refreshed = await getCodexUsageStatus();
      updateCodexUsage(refreshed);
    } else {
      codexUsage = emptyCodexUsage(enabled, enabled ? "unavailable" : "disabled");
    }
    if (!enabled) {
      settings = { ...settings, codexUsageEnabled: false };
      saveSettings(settings);
    } else if (!codexUsage.enabled) {
      codexUsage = emptyCodexUsage(true, "unavailable");
    }
  } catch (error: unknown) {
    console.warn("Unable to update the Codex usage setting", error);
    if (enabled) {
      codexUsage = emptyCodexUsage(true, "unavailable");
    } else {
      settings = previousSettings;
      codexUsage = previousUsage;
    }
  } finally {
    codexUsageActivationPending = false;
    pendingCodexUsageAction = null;
    if (shell === "expanded" && expandedPanel === "codex") render();
  }
}

async function refreshCodexUsage(): Promise<void> {
  if (!settings.codexUsageEnabled || pendingCodexUsageAction !== null) return;

  pendingCodexUsageAction = "refresh";
  if (codexUsage.status !== "ready") {
    codexUsage = { ...codexUsage, enabled: true, status: "checking" };
  }
  if (shell === "expanded" && expandedPanel === "codex") render();

  try {
    if (!nativeRuntime) {
      codexUsage = emptyCodexUsage(true, "unavailable");
      return;
    }
    await refreshNativeCodexUsage();
    const refreshed = await getCodexUsageStatus();
    updateCodexUsage(refreshed);
  } catch (error: unknown) {
    console.warn("Unable to refresh Codex usage", error);
    codexUsage = emptyCodexUsage(true, "unavailable");
  } finally {
    pendingCodexUsageAction = null;
    if (shell === "expanded" && expandedPanel === "codex") render();
  }
}

function emptyCodexUsage(
  enabled: boolean,
  status: CodexUsageStatus["status"],
): CodexUsageStatus {
  return {
    enabled,
    status,
    windows: [],
    dailyUsage: [],
    activityAvailable: false,
    updatedAtMs: null,
    source: "codex_app_server",
  };
}

function hasEnergyRecordForDay(status: EnergyStatus, dayKey: string): boolean {
  return (status.available && status.dayKey === dayKey) || status.history.some((entry) => entry.dayKey === dayKey);
}

function sameEnergyHistory(
  left: readonly EnergyStatus["history"][number][],
  right: readonly EnergyStatus["history"][number][],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.dayKey === right[index]?.dayKey &&
        entry.totalMwh === right[index]?.totalMwh &&
        entry.partial === right[index]?.partial,
    )
  );
}

function volumeLevelFromControl(value: string): number | null {
  const percentage = Number(value);
  if (!Number.isFinite(percentage)) return null;
  return Math.min(1, Math.max(0, percentage / 100));
}

function mediaSeekPositionFromControl(
  control: HTMLInputElement,
  current: MediaStatus,
): number | null {
  if (control.dataset.sessionRevision !== String(current.sessionRevision)) return null;
  const seconds = Number(control.value);
  if (!Number.isFinite(seconds)) return null;
  return normalizeMediaSeekPosition(current, seconds * 1_000);
}

function previewMediaSeek(
  control: HTMLInputElement,
  current: MediaStatus,
  positionMs: number,
): void {
  const durationMs = current.durationMs;
  if (durationMs === undefined || durationMs <= 0) return;
  const ratio = Math.min(1, Math.max(0, positionMs / durationMs));
  const copy = copyFor(settings.language).media;
  control.style.setProperty("--media-progress", `${ratio * 100}%`);
  control.setAttribute(
    "aria-valuetext",
    copy.progressValue(formatPlaybackTime(positionMs), formatPlaybackTime(durationMs)),
  );
  control
    .closest(".media-progress")
    ?.querySelector<HTMLElement>("[data-media-elapsed]")
    ?.replaceChildren(formatPlaybackTime(positionMs));
}

async function setSystemVolume(level: number): Promise<void> {
  const previous = volume;
  const revision = ++volumeCommandRevision;
  volume = { ...volume, level };

  if (!nativeRuntime || demoOverride === "volume") {
    updateVolume({ level, muted: volume.muted });
    return;
  }

  let accepted = false;
  try {
    accepted = await setNativeSystemVolume(level);
  } catch (error: unknown) {
    console.warn("Unable to change system volume", error);
  }
  if (!accepted && revision === volumeCommandRevision) {
    volume = previous;
    render();
  }
}

async function setSystemMute(muted: boolean): Promise<void> {
  const previous = volume;
  const revision = ++volumeCommandRevision;
  volume = { ...volume, muted };
  render();

  if (!nativeRuntime || demoOverride === "volume") {
    updateVolume({ level: volume.level, muted });
    return;
  }

  let accepted = false;
  try {
    accepted = await setNativeSystemMute(muted);
  } catch (error: unknown) {
    console.warn("Unable to change system mute state", error);
  }
  if (!accepted && revision === volumeCommandRevision) {
    volume = previous;
    render();
  }
}

function scheduleMediaProgressTick(): void {
  if (mediaProgressTickId !== null) {
    window.clearInterval(mediaProgressTickId);
    mediaProgressTickId = null;
  }
  if (
    document.hidden ||
    (shell !== "expanded" && shell !== "compact") ||
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

function scheduleCodexUsageTick(): void {
  if (codexUsageTickId !== null) {
    window.clearTimeout(codexUsageTickId);
    codexUsageTickId = null;
  }
  if (
    document.hidden ||
    shell !== "expanded" ||
    expandedPanel !== "codex" ||
    !codexUsage.enabled ||
    codexUsage.status !== "ready" ||
    codexUsage.windows.length === 0
  ) {
    return;
  }

  const nextMinute = 60_000 - (Date.now() % 60_000) + 16;
  codexUsageTickId = window.setTimeout(() => {
    codexUsageTickId = null;
    if (shell === "expanded" && expandedPanel === "codex") render();
  }, nextMinute);
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
    void setShell(pointerInside || notchPinned || settings.notchVisibility === "always" ? "compact" : "reef", animate);
  } else {
    void setShell("compact", animate);
  }
}

function shouldHideForFullscreen(): boolean {
  return fullscreen && !fullscreenOverride && settings.hideInFullscreen;
}

function collapse(): void {
  notchPinned = false;
  pointerInside = false;
  clearNotchHover();
  clearNotchLeave();
  clearExpandedExpiry();
  content = "idle";
  if (manuallyHidden || shouldHideForFullscreen()) void setShell("hidden");
  else void setShell(settings.notchVisibility === "always" ? "compact" : "reef");
}

async function setShell(next: ShellState, animated = !reducedMotion.matches, forceNative = false): Promise<void> {
  const previous = shell;
  if (next === "hidden") {
    pointerInside = false;volumeEditing = false;deferredRender = false;
    clearNotchHover();clearNotchLeave();
  }
  if (next !== "expanded") clearExpandedExpiry();
  if (forceNative) nativeAcceptedShell = null;
  animateNextShellContent = animated && previous !== next;
  suppressNotchMotion = !animated;
  setShellTransition(previous, next, animateNextShellContent);
  shell = next;
  render();
  suppressNotchMotion = false;
  if (!previewMode && next === "expanded" && (previous !== "expanded" || expandedExpiryId === null)) setExpandedExpiry();
}

async function presentNativeNotchFrame(geometry: NotchGeometry, state: ShellState, edge: NotchEdge): Promise<void> {
  if (!nativeRuntime) return;
  const theme = lightColorScheme.matches ? "light" : "dark";
  const signature = `${state}:${edge}:${theme}:${geometry.width}:${geometry.height}:${geometry.path}`;
  if (nativeAcceptedShell?.signature === signature) return;
  await applyNativeShell({shell:state, width:geometry.width, height:geometry.height,
    cornerRadius:geometry.cornerRadius, animated:false, topMargin:0, edge,
    regions:geometry.regions, theme, transitionId:++shellRevision});
  nativeAcceptedShell = {shell:state,signature};
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
  expandedExpiryDeadline = Date.now() + EXPANDED_AUTO_COLLAPSE_MS;
  scheduleExpandedExpiry(expandedSessionRevision);
}

function scheduleExpandedExpiry(sessionRevision: number): void {
  const delay = Math.max(0, expandedExpiryDeadline - Date.now());
  expandedExpiryId = window.setTimeout(() => {
    expandedExpiryId = null;
    if (sessionRevision !== expandedSessionRevision || shell !== "expanded") return;

    if (
      pendingMediaCommand !== null ||
      pendingMediaSeek !== null ||
      mediaSeekEditing ||
      volumeEditing || pendingSourceSelection || pendingCodexUsageAction !== null || pointerInside || notchPinned || (keyboardNavigation && app.contains(document.activeElement))
    ) {
      expandedExpiryDeadline = Date.now() + EXPANDED_AUTO_COLLAPSE_MS;
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
  expandedExpiryDeadline = Date.now() + EXPANDED_AUTO_COLLAPSE_MS;
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
  if (
    !current ||
    !mediaCommandEnabled(command, current) ||
    pendingMediaCommand !== null ||
    pendingMediaSeek !== null
  ) {
    return;
  }

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

async function selectMediaSource(value?: string): Promise<void> {
  if (pendingSourceSelection || pendingMediaSeek !== null) return;
  const source = sourceForSelectionValue(value);
  if (value !== "auto" && !source) return;

  pendingSourceSelection = true;
  resetExpandedExpiry();
  render();

  let accepted = false;
  try {
    if (!nativeRuntime) {
      applyDemoSourceSelection(source);
      accepted = true;
    } else {
      accepted = await selectNativeMediaSource(source?.providerId, source?.sourceId);
      if (accepted) {
        const refreshed = await getMediaStatus();
        updateMediaConnect(refreshed);
      }
    }
  } catch (error: unknown) {
    console.warn("Unable to select the media source", error);
  }

  pendingSourceSelection = false;
  expandedPanel = "media";
  if (!accepted) {
    setMediaCommandFeedback(copyFor(settings.language).media.sourceChangeUnavailable, true, 1600);
  }
  render();
}

function sourceForSelectionValue(value?: string): MediaSource | null {
  if (value === "auto") return null;
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= mediaConnection.sources.length) {
    return null;
  }
  return mediaConnection.sources[index] ?? null;
}

function applyDemoSourceSelection(source: MediaSource | null): void {
  mediaConnection = {
    ...mediaConnection,
    manualSource: source
      ? { providerId: source.providerId, sourceId: source.sourceId }
      : null,
  };
  if (source && media) {
    media = {
      ...media,
      source: source.label,
      sessionRevision: media.sessionRevision + 1,
      positionUpdatedAtMs: Date.now(),
    };
  }
}

function queueMediaSeek(
  current: MediaStatus,
  positionMs: number,
  control: HTMLInputElement,
): void {
  const request: PendingMediaSeek = {
    identity: mediaIdentityFor(current),
    positionMs,
    sessionRevision: current.sessionRevision,
  };
  pendingMediaSeek = request;
  restoreMediaSeekFocus ||= document.activeElement === control;
  control.dataset.seekPending = "true";
  resetExpandedExpiry();
  if (mediaSeekCommitId !== null) window.clearTimeout(mediaSeekCommitId);
  mediaSeekCommitId = window.setTimeout(() => {
    mediaSeekCommitId = null;
    void commitMediaSeek(request);
  }, 140);
}

function cancelPendingMediaSeek(): void {
  if (mediaSeekCommitId !== null) window.clearTimeout(mediaSeekCommitId);
  mediaSeekCommitId = null;
  pendingMediaSeek = null;
  mediaSeekEditing = false;
  restoreMediaSeekFocus = false;
}

async function commitMediaSeek(request: PendingMediaSeek): Promise<void> {
  if (pendingMediaSeek !== request) return;
  const current = media;
  const sameTarget =
    current?.sessionRevision === request.sessionRevision &&
    mediaIdentityFor(current) === request.identity;
  if (!current || !sameTarget) {
    cancelPendingMediaSeek();
    render();
    return;
  }

  const previous = current;
  const optimistic = optimisticMediaSeek(current, request.positionMs);
  media = optimistic;

  if (!nativeRuntime || demoOverride === "media") {
    pendingMediaSeek = null;
    render();
    return;
  }

  render();
  let accepted = false;
  try {
    accepted = await runNativeMediaSeek(request.positionMs, request.sessionRevision);
  } catch (error: unknown) {
    console.warn("Unable to seek media playback", error);
  }

  if (pendingMediaSeek !== request) return;
  const currentTarget =
    media?.sessionRevision === request.sessionRevision &&
    mediaIdentityFor(media) === request.identity;
  if (!accepted && currentTarget && media === optimistic) media = previous;

  pendingMediaSeek = null;
  if (!accepted && currentTarget) {
    setMediaCommandFeedback(copyFor(settings.language).media.seekUnavailable, true, 1600);
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

function preferredExpandedPanel(): ExpandedPanel {
  return "home";
}

function render(): void {
  if (volumeEditing && shell !== "hidden") {
    deferredRender = true;
    return;
  }
  deferredRender = false;

  const now = Date.now();
  const vm: AppViewModel = {
    shell,
    notchPinned,
    content,
    expandedPanel,
    media,
    mediaConnection,
    volume,
    energy,
    codexUsage,
    selectedEnergyDayKey,
    settings,
    pendingMediaCommand,
    pendingMediaSeek: pendingMediaSeek !== null,
    pendingSourceSelection,
    pendingCodexUsageAction,
    mediaCommandFeedback,
    showInlineVolume: now < volumeVisibleUntil,
    animateContent: animateNextShellContent,
    motionDisabled: reducedMotion.matches || suppressNotchMotion,
    now,
  };
  animateNextShellContent = false;
  renderApp(app, vm, nativeRuntime ? presentNativeNotchFrame : undefined);
  scheduleMediaProgressTick();
  scheduleCodexUsageTick();
  restoreMediaSeekFocusIfReady();
}

function restoreMediaSeekFocusIfReady(): void {
  if (!restoreMediaSeekFocus || pendingMediaSeek !== null) return;
  const control = app.querySelector<HTMLInputElement>("[data-control='media-seek']");
  if (!control || control.disabled) return;
  control.focus({ preventScroll: true });
  restoreMediaSeekFocus = false;
}
