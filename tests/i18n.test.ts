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
  assert.equal(copy.settings.subtitle, "Placement and visibility");
  assert.equal(copy.settings.fullscreenDetail, "Hide Atoll automatically");
  assert.equal(copy.media.players(2), "2 players");
  assert.equal(copy.media.progressValue("1:05", "3:20"), "1:05 of 3:20");
  assert.equal(copy.media.seek, "Seek playback");
  assert.equal(copy.media.sourceAutomatic, "Automatic");
  assert.equal(copy.media.sourcePinned, "Pinned");
  assert.equal(copy.energy.todayBatteryDischarge("0.42", "kWh"), "Today's battery discharge: 0.42 kWh");
  assert.equal(copy.energy.todayBatteryDischargeTitle, "Today's battery discharge");
  assert.equal(copy.energy.batteryDischargeOnly, "Battery discharge only");
  assert.equal(copy.energy.openHistory, "View the last 30 days");
  assert.equal(copy.energy.historySubtitle, "Last 30 days");
  assert.equal(
    copy.energy.historyEntry("8/7", "0.42", "kWh", true),
    "8/7: 0.42 kWh, partial record",
  );
  assert.equal(copy.codex.enableTitle, "Use Codex usage in Atoll?");
  assert.equal(copy.codex.usagePercent("32.5"), "32.5% used");
  assert.equal(copy.codex.resetIn("1h 24m"), "Resets in 1h 24m");
  assert.equal(copy.codex.windowFallback(300), "5-hour window");
  assert.equal(
    copy.codex.sourcePrivacy,
    "Local App Server only · no prompts, files, account IDs, or API keys",
  );
});

test("provides representative Simplified Chinese settings and dynamic copy", () => {
  const copy = copyFor("zh-CN");

  assert.equal(copy.settings.title, "设置");
  assert.equal(copy.settings.subtitle, "停靠与显示");
  assert.equal(copy.settings.fullscreenDetail, "自动隐藏 Atoll");
  assert.equal(copy.media.players(2), "2 个播放器");
  assert.equal(copy.media.progressValue("1:05", "3:20"), "1:05 / 3:20");
  assert.equal(copy.media.seek, "调整播放进度");
  assert.equal(copy.media.sourceAutomatic, "自动");
  assert.equal(copy.media.sourcePinned, "已固定");
  assert.equal(copy.energy.todayBatteryDischarge("0.42", "度"), "今日电池放电：0.42 度");
  assert.equal(copy.energy.todayBatteryDischargeTitle, "今日电池放电");
  assert.equal(copy.energy.batteryDischargeOnly, "仅电池放电");
  assert.equal(copy.energy.openHistory, "查看近 30 天");
  assert.equal(copy.energy.historySubtitle, "近 30 天");
  assert.equal(copy.energy.historyEntry("8/7", "0.42", "度", true), "8/7：0.42 度，部分记录");
  assert.equal(copy.codex.enableTitle, "要在 Atoll 中使用 Codex 用量吗？");
  assert.equal(copy.codex.usagePercent("32.5"), "已用 32.5%");
  assert.equal(copy.codex.resetIn("1 小时 24 分钟"), "1 小时 24 分钟后重置");
  assert.equal(copy.codex.windowFallback(300), "300 分钟窗口");
  assert.equal(
    copy.codex.sourcePrivacy,
    "仅本机 App Server · 不读取提示词、文件、账户 ID 或 API 密钥",
  );
});


test("localizes notch navigation, pinning, placement and visibility", () => {
  const english = copyFor("en").notch;
  const chinese = copyFor("zh-CN").notch;
  assert.deepEqual(english.edges, { top: "Top", bottom: "Bottom", left: "Left", right: "Right" });
  assert.deepEqual(chinese.edges, { top: "顶部", bottom: "底部", left: "左侧", right: "右侧" });
  assert.equal(english.energy, "Battery discharge");
  assert.equal(chinese.energy, "电池放电");
  assert.equal(english.automatic, "On hover");
  assert.equal(chinese.always, "始终显示");
  assert.equal(english.pin, "Keep this panel open");
  assert.equal(chinese.unpin, "取消固定面板");
  for (const [key, value] of Object.entries(english)) {
    assert.ok(value, `English notch copy missing: ${key}`);
    assert.ok(chinese[key as keyof typeof chinese], `Chinese notch copy missing: ${key}`);
  }
});
