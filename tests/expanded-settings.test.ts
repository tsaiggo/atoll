import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { AppViewModel, ExpandedPanel } from "../src/app/types.ts";

const sourceRoot = new URL("../src/", import.meta.url).href;
const moduleHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts") && context.parentURL?.startsWith(sourceRoot)) {
      return { shortCircuit: true, url: new URL(`${specifier}.ts`, context.parentURL).href };
    }
    return nextResolve(specifier, context);
  },
});
const { renderExpandedShell } = await import("../src/ui/expanded.ts");
const { DEFAULT_SETTINGS } = await import("../src/config.ts");
moduleHooks.deregister();

function viewModel(expandedPanel: ExpandedPanel): AppViewModel {
  return {
    shell: "expanded",
    content: "idle",
    expandedPanel,
    media: null,
    mediaConnection: { status: "no_session", sessionCount: 0, sources: [], manualSource: null },
    volume: { level: 0.375, muted: false },
    energy: {
      available: false,
      todayMwh: 0,
      dayKey: "",
      trackingSinceMs: 0,
      partial: false,
      history: [],
      source: "battery_discharge",
    },
    codexUsage: {
      enabled: false,
      status: "disabled",
      windows: [],
      dailyUsage: [],
      activityAvailable: false,
      updatedAtMs: null,
      source: "codex_app_server",
    },
    selectedEnergyDayKey: null,
    settings: { ...DEFAULT_SETTINGS },
    pendingMediaCommand: null,
    pendingMediaSeek: false,
    pendingSourceSelection: false,
    pendingCodexUsageAction: null,
    mediaCommandFeedback: null,
    showInlineVolume: false,
    animateContent: false,
    motionDisabled: false,
    now: 1_754_587_200_000,
  };
}

test("exposes all four edge choices and marks only the saved edge selected", () => {
  for (const notchEdge of ["top", "bottom", "left", "right"] as const) {
    const vm = viewModel("settings");
    vm.settings.notchEdge = notchEdge;
    const html = renderExpandedShell(vm);
    const edgeButtons = [...html.matchAll(/<button[^>]*data-action="set-notch-edge"[^>]*>/g)].map(([button]) => button);
    assert.equal(edgeButtons.length, 4);
    assert.equal(edgeButtons.filter((button) => button.includes('aria-pressed="true"')).length, 1);
    assert.ok(edgeButtons.some((button) => button.includes(`data-value="${notchEdge}"`) && button.includes('aria-pressed="true"')));
  }
});

test("reflects persistent rail visibility and keeps Codex opt-in out of generic settings", () => {
  const vm = viewModel("settings");
  vm.settings.notchVisibility = "always";
  const html = renderExpandedShell(vm);
  assert.match(html, /data-action="set-notch-visibility" data-value="auto" aria-pressed="false"/);
  assert.match(html, /data-action="set-notch-visibility" data-value="always" aria-pressed="true"/);
  assert.match(html, /data-action="toggle-setting" data-value="hideInFullscreen"/);
  assert.doesNotMatch(html, /data-action="enable-codex-usage"/);
});

test("renders volume from the live model with the system slider and mute command", () => {
  const html = renderExpandedShell(viewModel("volume"));
  assert.match(html, /expanded--volume/);
  assert.match(html, /<output data-volume-value>38<\/output>/);
  assert.match(html, /value="38" data-control="system-volume"/);
  assert.match(html, /aria-valuetext="38 percent"/);
  assert.match(html, /data-action="toggle-volume-mute" aria-label="Mute system volume" aria-pressed="false"/);
  assert.doesNotMatch(html, /No active media/);
});

test("keeps the real saved volume visible when muted and translates its controls", () => {
  const vm = viewModel("volume");
  vm.settings.language = "zh-CN";
  vm.volume.level = 0.83;
  vm.volume.muted = true;
  const html = renderExpandedShell(vm);
  assert.match(html, /<output data-volume-value>83<\/output>/);
  assert.match(html, /aria-valuetext="已静音，音量 83%"/);
  assert.match(html, /data-action="toggle-volume-mute" aria-label="恢复系统音量" aria-pressed="true"/);
  assert.match(html, /已静音/);
});
