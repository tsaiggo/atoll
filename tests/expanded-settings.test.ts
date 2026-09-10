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
const { renderNotch } = await import("../src/ui/notch.ts");
const { DEFAULT_SETTINGS } = await import("../src/config.ts");
moduleHooks.deregister();

function viewModel(expandedPanel: ExpandedPanel): AppViewModel {
  return {
    shell: "expanded",
    content: "idle",
    expandedPanel,
    media: null,
    mediaConnection: { status: "no_session", sessionCount: 0, sources: [], manualSource: null },
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

test("energy totals include only the 30 calendar days and preserve zero, gaps and partial records", () => {
  const vm = viewModel("energy");
  vm.energy = { available: true, todayMwh: 20_000, dayKey: "2026-03-01", trackingSinceMs: 1,
    partial: true, source: "battery_discharge", history: [
      { dayKey: "2026-02-28", totalMwh: 0, partial: false },
      { dayKey: "2026-02-01", totalMwh: 40_000, partial: true },
      { dayKey: "2026-01-31", totalMwh: 10_000, partial: false },
      { dayKey: "2026-01-30", totalMwh: 999_000, partial: false },
    ] };
  const html = renderExpandedShell(vm);
  assert.equal((html.match(/class="energy-history__day /g) ?? []).length, 30);
  assert.match(html, /Recorded · 30 days<\/dt><dd>70.00 Wh/);
  assert.match(html, /Peak daily record<\/dt><dd>40.00 Wh/);
  assert.match(html, /4\/30 · 2 partial/);
  assert.equal((html.match(/type="button" disabled title=/g) ?? []).length, 26);
  assert.match(html, /2\/28: 0.00 Wh/);
  assert.match(html, /--energy-bar:0%/);
  assert.doesNotMatch(html, /999.00/);
});

test("unavailable current reading retains historical totals and selected partial-day details", () => {
  const vm = viewModel("energy");
  vm.energy = { available: false, todayMwh: 0, dayKey: "2026-09-10", trackingSinceMs: 0,
    partial: true, source: "battery_discharge", history: [{ dayKey: "2026-09-09", totalMwh: 51_000, partial: true }] };
  vm.selectedEnergyDayKey = "2026-09-09";
  const html = renderExpandedShell(vm);
  assert.match(html, /Today so far<\/dt><dd>—/);
  assert.match(html, /Recorded · 30 days<\/dt><dd>51.00 Wh/);
  assert.match(html, /1\/30 · 1 partial/);
  assert.match(html, /Partial record/);
});

test("no measurements produce the honest empty state rather than zero-valued statistics", () => {
  const vm = viewModel("energy");
  vm.energy = { available: false, todayMwh: 0, dayKey: "2026-09-10", trackingSinceMs: 0,
    partial: true, source: "battery_discharge", history: [] };
  const html = renderExpandedShell(vm);
  assert.match(html, /energy-card--empty/);
  assert.doesNotMatch(html, /class="energy-stats"/);
});

test("rail exposes only media, energy and Codex after volume removal", () => {
  const html = renderNotch(viewModel("energy"));
  const modules = [...html.matchAll(/data-notch-panel="(media|energy|codex|volume)"/g)].map(match => match[1]);
  assert.deepEqual(modules, ["media", "energy", "codex"]);
  assert.doesNotMatch(html, /system-volume|toggle-volume-mute/);
});
