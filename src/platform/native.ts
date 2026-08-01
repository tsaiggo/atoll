import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { MediaCommand } from "../features/media/commands";
import type {
  NativeMediaUpdatePayload,
  NativeVolumePayload,
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
  theme: "light" | "dark";
}

export interface NativeEventHandlers {
  onAction(action: string): void;
  onMediaUpdate(payload: NativeMediaUpdatePayload): void;
  onVolume(payload: NativeVolumePayload): void;
  onTimerElapsed(shouldSurface: boolean): void;
  onFullscreenChanged(payload: { fullscreen: boolean }): void;
}

export const nativeRuntime = Boolean(window.__TAURI_INTERNALS__);

export function getFullscreen(): Promise<boolean> {
  return invoke<boolean>("is_fullscreen_active");
}

export function getMediaStatus(): Promise<NativeMediaUpdatePayload> {
  return invoke<NativeMediaUpdatePayload>("media_status");
}

export function applyNativeShell(request: NativeShellRequest): Promise<void> {
  return invoke("set_window_shell", {
    shell: request.shell,
    width: request.width,
    height: request.height,
    cornerRadius: request.cornerRadius,
    animated: request.animated,
    topMargin: request.topMargin,
    theme: request.theme,
  });
}

export function showNativeContextMenu(): Promise<void> {
  return invoke("show_context_menu");
}

export function runNativeMediaCommand(
  command: MediaCommand,
  sessionRevision: number,
): Promise<boolean> {
  return invoke<boolean>("media_command", { command, sessionRevision });
}

export function scheduleNativeTimer(
  endAtMs: number | null,
  breakFullscreen: boolean,
): Promise<void> {
  return invoke("schedule_timer", { endAtMs, breakFullscreen });
}

export function subscribeNativeEvents(handlers: NativeEventHandlers): Promise<UnlistenFn[]> {
  return Promise.all([
    listen<string>("atoll-action", ({ payload }) => handlers.onAction(payload)),
    listen<NativeMediaUpdatePayload>("media-update", ({ payload }) =>
      handlers.onMediaUpdate(payload),
    ),
    listen<NativeVolumePayload>("system-volume", ({ payload }) => handlers.onVolume(payload)),
    listen<boolean>("timer-elapsed", ({ payload }) => handlers.onTimerElapsed(payload)),
    listen<{ fullscreen: boolean }>("fullscreen-changed", ({ payload }) =>
      handlers.onFullscreenChanged(payload),
    ),
  ]);
}
