import assert from "node:assert/strict";
import test from "node:test";

import {
  codexUsageSignalKey,
  codexUsageTransition,
  formatCodexResetCountdown,
  formatCodexUsagePercent,
  normalizeCodexUsage,
  selectCodexUsageWindows,
  type CodexUsageStatus,
} from "../src/domain.ts";

const NOW = 1_754_587_200_000;

function readyStatus(
  windows: CodexUsageStatus["windows"],
  overrides: Partial<CodexUsageStatus> = {},
): CodexUsageStatus {
  return {
    enabled: true,
    status: "ready",
    windows,
    dailyUsage: [],
    activityAvailable: false,
    updatedAtMs: NOW,
    source: "codex_app_server",
    ...overrides,
  };
}

test("normalizes Codex usage without turning malformed windows into zero usage", () => {
  const usage = normalizeCodexUsage({
    enabled: true,
    status: "ready",
    windows: [
      {
        id: " five-hour ",
        label: " 5-hour limit ",
        used_percent: 32.5,
        window_duration_mins: 300,
        resets_at_ms: NOW + 60_000,
        reached: false,
      },
      {
        id: "missing-percent",
        window_duration_mins: 300,
        resets_at_ms: NOW + 60_000,
      },
      {
        id: "bad-percent",
        used_percent: 101,
        window_duration_mins: 300,
        resets_at_ms: NOW + 60_000,
      },
    ],
    daily_usage: [
      { day_key: "2026-08-08", tokens: 2400.8 },
      { day_key: "not-a-day", tokens: 999 },
      { day_key: "2026-08-07", tokens: -1 },
    ],
    activity_available: true,
    updated_at_ms: NOW,
    source: "codex_app_server",
  });

  assert.deepEqual(usage, {
    enabled: true,
    status: "ready",
    windows: [
      {
        id: "five-hour",
        label: "5-hour limit",
        usedPercent: 32.5,
        windowDurationMins: 300,
        resetsAtMs: NOW + 60_000,
        reached: false,
      },
    ],
    dailyUsage: [{ dayKey: "2026-08-08", tokens: 2400 }],
    activityAvailable: true,
    updatedAtMs: NOW,
    source: "codex_app_server",
  });
});

test("falls back to an honest unavailable state when a Codex status is unknown", () => {
  assert.deepEqual(normalizeCodexUsage({ enabled: true, status: "future-status" }), {
    enabled: true,
    status: "unavailable",
    windows: [],
    dailyUsage: [],
    activityAvailable: false,
    updatedAtMs: null,
    source: "codex_app_server",
  });
  assert.equal(normalizeCodexUsage({ enabled: false, status: "future-status" }).status, "disabled");
});

test("selects the most constrained Codex window first regardless of publish order", () => {
  const selection = selectCodexUsageWindows([
    {
      id: "weekly",
      label: "Weekly",
      usedPercent: 14,
      windowDurationMins: 10_080,
      resetsAtMs: NOW + 600_000,
      reached: false,
    },
    {
      id: "five-hour",
      label: "5-hour",
      usedPercent: 92,
      windowDurationMins: 300,
      resetsAtMs: NOW + 300_000,
      reached: false,
    },
    {
      id: "reached",
      label: "Reached",
      usedPercent: 100,
      windowDurationMins: 60,
      resetsAtMs: NOW + 100_000,
      reached: true,
    },
  ]);

  assert.equal(selection.primary?.id, "reached");
  assert.equal(selection.secondary?.id, "five-hour");
});

test("retains later valid windows before choosing the two displayed limits", () => {
  const usage = normalizeCodexUsage({
    enabled: true,
    status: "ready",
    windows: [
      {
        id: "first",
        used_percent: 8,
        window_duration_mins: 60,
        resets_at_ms: NOW + 60_000,
      },
      {
        id: "second",
        used_percent: 21,
        window_duration_mins: 300,
        resets_at_ms: NOW + 120_000,
      },
      {
        id: "third-most-constrained",
        used_percent: 96,
        window_duration_mins: 10_080,
        resets_at_ms: NOW + 180_000,
      },
    ],
  });

  assert.equal(usage.windows.length, 3);
  assert.equal(selectCodexUsageWindows(usage.windows).primary?.id, "third-most-constrained");
});

test("formats Codex reset countdowns from explicit time without a background poll", () => {
  assert.equal(formatCodexResetCountdown(NOW + 30_000, "en", NOW), "< 1m");
  assert.equal(formatCodexResetCountdown(NOW + 84 * 60_000, "en", NOW), "1h 24m");
  assert.equal(formatCodexResetCountdown(NOW + 26 * 60 * 60_000, "zh-CN", NOW), "1 天 2 小时");
  assert.equal(formatCodexResetCountdown(NOW, "en", NOW), null);
  assert.equal(formatCodexUsagePercent(32.5, "en"), "32.5");
  assert.equal(formatCodexUsagePercent(32.5, "zh-CN"), "32.5");
});

test("emits one real threshold or reset transition rather than an initial snapshot", () => {
  const baseWindow = {
    id: "five-hour",
    label: "5-hour",
    windowDurationMins: 300,
    resetsAtMs: NOW + 60_000,
    reached: false,
  };
  const at79 = readyStatus([{ ...baseWindow, usedPercent: 79 }]);
  const at80 = readyStatus([{ ...baseWindow, usedPercent: 80 }]);
  const at95 = readyStatus([{ ...baseWindow, usedPercent: 95 }]);
  const reached = readyStatus([{ ...baseWindow, usedPercent: 100, reached: true }]);

  assert.equal(codexUsageTransition(null, at80), null);
  assert.deepEqual(codexUsageTransition(at79, at80), {
    kind: "threshold-80",
    windowId: "five-hour",
    resetsAtMs: NOW + 60_000,
  });
  assert.equal(codexUsageTransition(at80, at80), null);
  assert.deepEqual(codexUsageTransition(at80, at95), {
    kind: "threshold-95",
    windowId: "five-hour",
    resetsAtMs: NOW + 60_000,
  });
  const reachedSignal = codexUsageTransition(at95, reached);
  assert.deepEqual(reachedSignal, {
    kind: "reached",
    windowId: "five-hour",
    resetsAtMs: NOW + 60_000,
  });
  assert.equal(codexUsageSignalKey(reachedSignal!), "reached:five-hour:1754587260000");

  const beforeReset = readyStatus(
    [{ ...baseWindow, usedPercent: 97, reached: false, resetsAtMs: NOW - 10 * 60_000 }],
    { updatedAtMs: NOW - 10 * 60_000 },
  );
  const afterReset = readyStatus([
    { ...baseWindow, usedPercent: 2, resetsAtMs: NOW + 300 * 60_000 },
  ]);
  assert.deepEqual(codexUsageTransition(beforeReset, afterReset), {
    kind: "reset",
    windowId: "five-hour",
    resetsAtMs: NOW + 300 * 60_000,
  });
});
