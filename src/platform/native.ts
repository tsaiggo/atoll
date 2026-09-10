import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { MediaCommand } from "../features/media/commands";
import type { UiLanguage } from "../i18n";
import type { NotchEdge, NotchRegion } from "../shell/geometry";
import type {
  NativeCodexUsagePayload,
  NativeEnergyPayload,
  NativeMediaUpdatePayload,
  ShellState,
} from "../domain";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export interface NativeShellRequest {
  shell: ShellState;
  width: number;
  height: number;
  cornerRadius: number;
  animated: boolean;
  topMargin: number;
  edge: NotchEdge;
  regions: NotchRegion[];
  theme: "light" | "dark";
  transitionId: number;
}

export interface NativeShellSettledPayload {
  transitionId: number;
}

export interface NativeEventHandlers {
  onAction(action: string): void;
  onCodexUsage(payload: NativeCodexUsagePayload): void;
  onEnergy(payload: NativeEnergyPayload): void;
  onMediaUpdate(payload: NativeMediaUpdatePayload): void;
  onFullscreenChanged(payload: { fullscreen: boolean }): void;
  onShellSettled(payload: NativeShellSettledPayload): void;
  onPointerPresence(inside: boolean): void;
}

export const nativeRuntime = Boolean(window.__TAURI_INTERNALS__);

export function getFullscreen(): Promise<boolean> {
  return invoke<boolean>("is_fullscreen_active");
}

export function getMediaStatus(): Promise<NativeMediaUpdatePayload> {
  return invoke<NativeMediaUpdatePayload>("media_status");
}

export function getEnergyStatus(): Promise<NativeEnergyPayload> {
  return invoke<NativeEnergyPayload>("energy_status");
}

export function getCodexUsageStatus(): Promise<NativeCodexUsagePayload> {
  return invoke<NativeCodexUsagePayload>("codex_usage_status");
}

export function setNativeCodexUsageEnabled(enabled: boolean): Promise<NativeCodexUsagePayload> {
  return invoke<NativeCodexUsagePayload>("codex_usage_set_enabled", { enabled });
}

export function refreshNativeCodexUsage(): Promise<NativeCodexUsagePayload> {
  return invoke<NativeCodexUsagePayload>("codex_usage_refresh");
}

export function applyNativeShell(request: NativeShellRequest): Promise<void> {
  return invoke("set_window_shell", {
    shell: request.shell,
    width: request.width,
    height: request.height,
    cornerRadius: request.cornerRadius,
    animated: request.animated,
    topMargin: request.topMargin,
    edge: request.edge,
    regions: request.regions,
    theme: request.theme,
    transitionId: request.transitionId,
  });
}

export function showNativeContextMenu(): Promise<void> {
  return invoke("show_context_menu");
}

export function setNativeMenuLanguage(language: UiLanguage): Promise<void> {
  return invoke("set_menu_language", { language });
}

export function runNativeMediaCommand(
  command: MediaCommand,
  sessionRevision: number,
): Promise<boolean> {
  return invoke<boolean>("media_command", { command, sessionRevision });
}

export function runNativeMediaSeek(
  positionMs: number,
  sessionRevision: number,
): Promise<boolean> {
  return invoke<boolean>("media_seek", { positionMs, sessionRevision });
}

export function selectNativeMediaSource(
  providerId?: string,
  sourceId?: string,
): Promise<boolean> {
  return invoke<boolean>("media_select_source", { providerId, sourceId });
}

export function subscribeNativeEvents(handlers: NativeEventHandlers): Promise<UnlistenFn[]> {
  return Promise.all([
    listen<boolean>("atoll-pointer-presence", ({ payload }) => handlers.onPointerPresence(payload)),
    listen<string>("atoll-action", ({ payload }) => handlers.onAction(payload)),
    listen<NativeCodexUsagePayload>("codex-usage-update", ({ payload }) =>
      handlers.onCodexUsage(payload),
    ),
    listen<NativeEnergyPayload>("energy-update", ({ payload }) => handlers.onEnergy(payload)),
    listen<NativeMediaUpdatePayload>("media-update", ({ payload }) =>
      handlers.onMediaUpdate(payload),
    ),
    listen<{ fullscreen: boolean }>("fullscreen-changed", ({ payload }) =>
      handlers.onFullscreenChanged(payload),
    ),
    listen<NativeShellSettledPayload>("atoll-shell-settled", ({ payload }) =>
      handlers.onShellSettled(payload),
    ),
  ]);
}
