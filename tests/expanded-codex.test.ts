import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const sourceRoot = new URL("../src/", import.meta.url).href;
const aliases: Record<string, string> = {
  "../app/types": new URL("../src/app/types.ts", import.meta.url).href,
  "../config": new URL("../src/config.ts", import.meta.url).href,
  "../domain": new URL("../src/domain.ts", import.meta.url).href,
  "../features/media/commands": new URL("../src/features/media/commands.ts", import.meta.url).href,
  "../icons": new URL("../src/icons.ts", import.meta.url).href,
  "../i18n": new URL("../src/i18n.ts", import.meta.url).href,
  "../shell/geometry": new URL("../src/shell/geometry.ts", import.meta.url).href,
  "./escape": new URL("../src/ui/escape.ts", import.meta.url).href,
  "./primitives": new URL("../src/ui/primitives.ts", import.meta.url).href,
  "./i18n": new URL("../src/i18n.ts", import.meta.url).href,
  "../../domain": new URL("../src/domain.ts", import.meta.url).href,
  "../../i18n": new URL("../src/i18n.ts", import.meta.url).href,
};
const moduleHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = aliases[specifier];
    if (resolved && context.parentURL?.startsWith(sourceRoot)) {
      return { shortCircuit: true, url: resolved };
    }
    return nextResolve(specifier, context);
  },
});
const { renderExpandedShell } = await import("../src/ui/expanded.ts");
moduleHooks.deregister();

const NOW = 1_754_587_200_000;

function viewModel(codexUsage: object, expandedPanel = "codex") {
  return {
    shell: "expanded",
    content: "idle",
    expandedPanel,
    media: null,
    mediaConnection: { status: "no_session", sessionCount: 0, sources: [], manualSource: null },
    volume: { level: 0.5, muted: false },
    energy: {
      available: false,
      todayMwh: 0,
      dayKey: "",
      trackingSinceMs: 0,
      partial: false,
      history: [],
      source: "battery_discharge",
    },
    codexUsage,
    selectedEnergyDayKey: null,
    settings: { language: "en", hideInFullscreen: true, codexUsageEnabled: false, topMargin: -12 },
    pendingMediaCommand: null,
    pendingMediaSeek: false,
    pendingSourceSelection: false,
    pendingCodexUsageAction: null,
    mediaCommandFeedback: null,
    showInlineVolume: false,
    animateContent: false,
    motionDisabled: false,
    now: NOW,
  };
}

function codexStatus(overrides: object = {}) {
  return {
    enabled: false,
    status: "disabled",
    windows: [],
    dailyUsage: [],
    activityAvailable: false,
    updatedAtMs: null,
    source: "codex_app_server",
    ...overrides,
  };
}

test("renders an explicit disabled Codex opt-in without adding a Home card", () => {
  const disabled = renderExpandedShell(viewModel(codexStatus()));
  assert.match(disabled, /expanded--codex/);
  assert.match(disabled, /Use Codex usage in Atoll\?/);
  assert.match(disabled, /data-action="enable-codex-usage"/);
  assert.match(disabled, /data-action="open-home"/);
  assert.doesNotMatch(disabled, /data-action="[^" ]*reset[^" ]*"/);

  const home = renderExpandedShell(viewModel(codexStatus(), "home"));
  assert.doesNotMatch(home, /Codex/);
});

test("renders checking and unavailable Codex states with safe recovery actions", () => {
  const checking = renderExpandedShell(
    viewModel(codexStatus({ enabled: true, status: "checking" })),
  );
  assert.match(checking, /Checking Codex usage…/);
  assert.doesNotMatch(checking, /data-action="refresh-codex-usage"/);

  const unavailable = renderExpandedShell(
    viewModel(codexStatus({ enabled: true, status: "unavailable" })),
  );
  assert.match(unavailable, /Codex usage unavailable/);
  assert.match(unavailable, /data-action="refresh-codex-usage"/);
  assert.match(unavailable, /data-action="disable-codex-usage"/);
});

test("renders real Codex windows with escaped labels and no reset-credit control", () => {
  const html = renderExpandedShell(
    viewModel(
      codexStatus({
        enabled: true,
        status: "ready",
        windows: [
          {
            id: "primary",
            label: "5-hour <script>alert(1)</script>",
            usedPercent: 92.5,
            windowDurationMins: 300,
            resetsAtMs: NOW + 84 * 60_000,
            reached: false,
          },
          {
            id: "secondary",
            label: "Weekly",
            usedPercent: 14,
            windowDurationMins: 10_080,
            resetsAtMs: NOW + 3 * 24 * 60 * 60_000,
            reached: false,
          },
        ],
      }),
    ),
  );

  assert.match(html, /5-hour &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /92\.5% used/);
  assert.match(html, /aria-valuenow="92\.5"/);
  assert.match(html, /aria-label="Weekly"/);
  assert.match(html, /aria-valuenow="14"/);
  assert.match(html, /Resets in 3d/);
  assert.match(html, /background:#FF3F00/);
  assert.match(html, /background:#00FF88/);
  assert.match(html, /Local App Server only · no prompts, files, account IDs, or API keys/);
  assert.doesNotMatch(html, /data-action="[^" ]*reset[^" ]*"/);
});
