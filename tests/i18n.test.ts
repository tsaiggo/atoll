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
});

test("provides representative Simplified Chinese settings and dynamic copy", () => {
  const copy = copyFor("zh-CN");

  assert.equal(copy.settings.title, "设置");
  assert.equal(copy.settings.subtitle, "主题和动效跟随 Windows");
  assert.equal(copy.settings.fullscreenDetail, "自动隐藏 Atoll");
  assert.equal(copy.media.players(2), "2 个播放器");
  assert.equal(copy.media.progressValue("1:05", "3:20"), "1:05 / 3:20");
});
