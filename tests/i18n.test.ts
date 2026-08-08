import assert from "node:assert/strict";
import test from "node:test";

import { copyFor, normalizeLanguage } from "../src/i18n.ts";

test("normalizes supported and unknown language values", () => {
  assert.equal(normalizeLanguage("zh-CN"), "zh-CN");
  assert.equal(normalizeLanguage("en"), "en");
  assert.equal(normalizeLanguage("zh"), "en");
  assert.equal(normalizeLanguage(undefined), "en");
  assert.equal(normalizeLanguage(null), "en");
});

test("provides representative English settings and dynamic copy", () => {
  const copy = copyFor("en");

  assert.equal(copy.settings.title, "Settings");
  assert.equal(copy.settings.subtitle, "Theme and motion follow Windows");
  assert.equal(copy.settings.fullscreenDetail, "Hide Atoll automatically");
  assert.equal(copy.media.players(2), "2 players");
  assert.equal(copy.media.progressValue("1:05", "3:20"), "1:05 of 3:20");
  assert.equal(copy.media.seek, "Seek playback");
  assert.equal(copy.media.sourceAutomatic, "Automatic");
  assert.equal(copy.media.sourcePinned, "Pinned");
  assert.equal(copy.volume.mute, "Mute system volume");
  assert.equal(copy.volume.unmute, "Unmute system volume");
  assert.equal(copy.energy.todayBatteryDischarge("0.42", "kWh"), "Today's battery discharge: 0.42 kWh");
  assert.equal(copy.energy.todayBatteryDischargeTitle, "Today's battery discharge");
  assert.equal(copy.energy.batteryDischargeOnly, "Battery discharge only");
  assert.equal(copy.energy.openHistory, "View the last 7 days");
  assert.equal(copy.energy.historySubtitle, "Last 7 days");
  assert.equal(
    copy.energy.historyEntry("8/7", "0.42", "kWh", true),
    "8/7: 0.42 kWh, partial record",
  );
});

test("provides representative Simplified Chinese settings and dynamic copy", () => {
  const copy = copyFor("zh-CN");

  assert.equal(copy.settings.title, "设置");
  assert.equal(copy.settings.subtitle, "主题和动效跟随 Windows");
  assert.equal(copy.settings.fullscreenDetail, "自动隐藏 Atoll");
  assert.equal(copy.media.players(2), "2 个播放器");
  assert.equal(copy.media.progressValue("1:05", "3:20"), "1:05 / 3:20");
  assert.equal(copy.media.seek, "调整播放进度");
  assert.equal(copy.media.sourceAutomatic, "自动");
  assert.equal(copy.media.sourcePinned, "已固定");
  assert.equal(copy.volume.mute, "静音系统音量");
  assert.equal(copy.volume.unmute, "恢复系统音量");
  assert.equal(copy.energy.todayBatteryDischarge("0.42", "度"), "今日电池放电：0.42 度");
  assert.equal(copy.energy.todayBatteryDischargeTitle, "今日电池放电");
  assert.equal(copy.energy.batteryDischargeOnly, "仅电池放电");
  assert.equal(copy.energy.openHistory, "查看近 7 天");
  assert.equal(copy.energy.historySubtitle, "近 7 天");
  assert.equal(copy.energy.historyEntry("8/7", "0.42", "度", true), "8/7：0.42 度，部分记录");
});
