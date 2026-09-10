import assert from "node:assert/strict";
import test from "node:test";

import {
  formatEnergyMeasurement,
  normalizeEnergy,
  normalizeMediaSourceSelection,
  normalizeMediaSources,
} from "../src/domain.ts";

test("normalizes and deduplicates source apps without exposing invalid records", () => {
  const sources = normalizeMediaSources([
    {
      provider_id: "builtin.windows-media-session",
      source_id: "QQMusic.exe",
      label: " QQ Music ",
      session_count: 1,
    },
    {
      provider_id: "builtin.windows-media-session",
      source_id: "QQMusic.exe",
      label: "Ignored duplicate label",
      session_count: 2,
    },
    {
      provider_id: "builtin.windows-media-session",
      source_id: "SpotifyAB.SpotifyMusic!App",
      label: "Spotify",
      session_count: 1,
    },
    { provider_id: "", source_id: "missing-provider", label: "Ignored" },
  ]);

  assert.deepEqual(sources, [
    {
      providerId: "builtin.windows-media-session",
      sourceId: "QQMusic.exe",
      label: "QQ Music",
      sessionCount: 3,
    },
    {
      providerId: "builtin.windows-media-session",
      sourceId: "SpotifyAB.SpotifyMusic!App",
      label: "Spotify",
      sessionCount: 1,
    },
  ]);
});

test("only accepts a manual selection that still exists in the published sources", () => {
  const sources = normalizeMediaSources([
    {
      provider_id: "builtin.windows-media-session",
      source_id: "QQMusic.exe",
      label: "QQ Music",
      session_count: 1,
    },
  ]);

  assert.deepEqual(
    normalizeMediaSourceSelection(
      {
        provider_id: "builtin.windows-media-session",
        source_id: "QQMusic.exe",
      },
      sources,
    ),
    {
      providerId: "builtin.windows-media-session",
      sourceId: "QQMusic.exe",
    },
  );
  assert.equal(
    normalizeMediaSourceSelection(
      {
        provider_id: "builtin.windows-media-session",
        source_id: "missing-player",
      },
      sources,
    ),
    null,
  );
});

test("normalizes daily battery discharge without presenting missing capacity as zero use", () => {
  assert.deepEqual(
    normalizeEnergy({
      available: true,
      today_mwh: 420_000,
      day_key: "2026-08-08",
      tracking_since_ms: 1_754_587_200_000,
      partial: true,
      source: "battery_discharge",
    }),
    {
      available: true,
      todayMwh: 420_000,
      dayKey: "2026-08-08",
      trackingSinceMs: 1_754_587_200_000,
      partial: true,
      history: [],
      source: "battery_discharge",
    },
  );
  assert.deepEqual(
    normalizeEnergy({
      available: false,
      today_mwh: 0,
      day_key: "2026-08-08",
      tracking_since_ms: null,
      partial: true,
      source: "battery_discharge",
    }),
    {
      available: false,
      todayMwh: 0,
      dayKey: "2026-08-08",
      trackingSinceMs: 0,
      partial: false,
      history: [],
      source: "battery_discharge",
    },
  );
});

test("normalizes completed battery history without turning missing days into zero use", () => {
  const energy = normalizeEnergy({
    available: true,
    today_mwh: 240_000,
    day_key: "2026-08-08",
    history: [
      { day_key: "2026-08-08", total_mwh: 999_000, partial: false },
      { day_key: "2026-08-07", total_mwh: 358_000, partial: false },
      { day_key: "2026-08-06", total_mwh: 612_000, partial: true },
      { day_key: "2026-08-06", total_mwh: 620_000, partial: false },
      { day_key: "2026-08-05", total_mwh: null, partial: false },
      { day_key: "2026-02-30", total_mwh: 100_000, partial: false },
      { day_key: "not-a-day", total_mwh: 100_000, partial: false },
    ],
  });

  assert.deepEqual(energy.history, [
    { dayKey: "2026-08-07", totalMwh: 358_000, partial: false },
    { dayKey: "2026-08-06", totalMwh: 620_000, partial: false },
  ]);
});

test("keeps completed history when Windows temporarily cannot report today's capacity", () => {
  const energy = normalizeEnergy({
    available: false,
    today_mwh: null,
    day_key: "2026-08-08",
    history: [{ day_key: "2026-08-07", total_mwh: 358_000, partial: true }],
  });

  assert.equal(energy.available, false);
  assert.deepEqual(energy.history, [
    { dayKey: "2026-08-07", totalMwh: 358_000, partial: true },
  ]);
});

test("formats battery discharge with a meaningful adaptive unit", () => {
  assert.deepEqual(formatEnergyMeasurement(420_000, "en"), { value: "420.00", unit: "Wh" });
  assert.deepEqual(formatEnergyMeasurement(57, "zh-CN"), { value: "0.06", unit: "Wh" });
  assert.deepEqual(formatEnergyMeasurement(1, "en"), { value: "1", unit: "mWh" });
  assert.deepEqual(formatEnergyMeasurement(0, "zh-CN"), { value: "0.00", unit: "Wh" });
  assert.deepEqual(formatEnergyMeasurement(9_999, "en"), { value: "10.00", unit: "Wh" });
  assert.deepEqual(formatEnergyMeasurement(10_000, "zh-CN"), { value: "10.00", unit: "Wh" });
  assert.deepEqual(formatEnergyMeasurement(1_000_000, "zh-CN"), { value: "1.00", unit: "度" });
});

test("normalization retains thirty historical days instead of truncating at seven", () => {
  const history = Array.from({length: 30}, (_, i) => ({day_key: `2026-08-${String(i+1).padStart(2,"0")}`, total_mwh: i * 1000, partial: i === 2}));
  const energy = normalizeEnergy({ available: true, day_key: "2026-08-31", today_mwh: 100, history });
  assert.equal(energy.history.length, 30);
  assert.equal(energy.history.at(-1)?.dayKey, "2026-08-01");
});
