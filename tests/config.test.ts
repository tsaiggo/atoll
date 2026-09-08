import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const configUrl = new URL("../src/config.ts", import.meta.url).href;
const i18nUrl = new URL("../src/i18n.ts", import.meta.url).href;
const moduleHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./i18n" && context.parentURL === configUrl) {
      return { shortCircuit: true, url: i18nUrl };
    }
    return nextResolve(specifier, context);
  },
});
const { DEFAULT_SETTINGS, loadSettings, saveSettings } = await import(
  "../src/config.ts"
);
moduleHooks.deregister();

const SETTINGS_KEY = "atoll.settings.v1";
const RETIRED_TIMER_KEY = "atoll.timer.v1";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, String(value));
  }
}

let storage: MemoryStorage;

test.beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
});

test.afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

test("migrates an existing hidden idle preference to the visible Reef default", () => {
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      hideInFullscreen: false,
      idleMode: "hidden",
      compactTimeoutMs: 3200,
    }),
  );

  const settings = loadSettings();

  assert.equal(settings.language, "en");
  assert.equal(settings.hideInFullscreen, false);
  assert.equal(settings.codexUsageEnabled, false);
  const stored = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null") as Record<string, unknown>;
  assert.equal("idleMode" in settings, false);
  assert.equal("compactTimeoutMs" in settings, false);
  assert.equal("idleMode" in stored, false);
  assert.equal("compactTimeoutMs" in stored, false);
});

test("persists Simplified Chinese in the existing v1 settings record", () => {
  saveSettings({ ...DEFAULT_SETTINGS, language: "zh-CN" });

  const stored = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null") as {
    language?: unknown;
  };
  assert.equal(stored.language, "zh-CN");
  assert.equal(loadSettings().language, "zh-CN");
});

test("keeps Codex usage off for older settings and persists only an explicit opt-in", () => {
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ language: "en", hideInFullscreen: true }),
  );
  assert.equal(loadSettings().codexUsageEnabled, false);

  saveSettings({ ...DEFAULT_SETTINGS, codexUsageEnabled: true });
  const stored = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null") as Record<string, unknown>;
  assert.equal(stored.codexUsageEnabled, true);
  assert.equal("prompts" in stored, false);
  assert.equal("files" in stored, false);
  assert.equal("apiKey" in stored, false);
});

test("falls back to English for an unsupported persisted language", () => {
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: "zh-TW" }),
  );

  assert.equal(loadSettings().language, "en");
});

test("retires legacy margins when migrating to edge placement", () => {
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, topMargin: 12 }),
  );

  assert.equal(loadSettings().topMargin, 0);
  const stored = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null") as Record<string, unknown>;
  assert.equal("topMargin" in stored, false);
});

test("cleans retired timer data and settings during upgrade", () => {
  storage.setItem(RETIRED_TIMER_KEY, JSON.stringify({ endAt: 1_700_000_000_000 }));
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      animationsEnabled: true,
      soundsEnabled: true,
      timerBreaksFullscreen: true,
      idleMode: "hidden",
      compactTimeoutMs: 3200,
      expandedTimeoutMs: 7000,
    }),
  );

  loadSettings();

  const stored = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null") as Record<
    string,
    unknown
  >;
  assert.equal(storage.getItem(RETIRED_TIMER_KEY), null);
  assert.equal("animationsEnabled" in stored, false);
  assert.equal("soundsEnabled" in stored, false);
  assert.equal("timerBreaksFullscreen" in stored, false);
  assert.equal("idleMode" in stored, false);
  assert.equal("compactTimeoutMs" in stored, false);
  assert.equal("expandedTimeoutMs" in stored, false);
});


test("starts on the top edge with a rail revealed on hover", () => {
  const settings = loadSettings();
  assert.equal(settings.notchEdge, "top");
  assert.equal(settings.notchVisibility, "auto");
  assert.equal(settings.codexUsageEnabled, false);
});

test("persists every edge and visibility choice without changing Codex opt-in", () => {
  for (const notchEdge of ["top", "bottom", "left", "right"] as const) {
    for (const notchVisibility of ["auto", "always"] as const) {
      saveSettings({ ...DEFAULT_SETTINGS, notchEdge, notchVisibility, codexUsageEnabled: true });
      const loaded = loadSettings();
      assert.equal(loaded.notchEdge, notchEdge);
      assert.equal(loaded.notchVisibility, notchVisibility);
      assert.equal(loaded.codexUsageEnabled, true);
      const stored = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null");
      assert.equal(stored.notchEdge, notchEdge);
      assert.equal(stored.notchVisibility, notchVisibility);
      assert.equal("topMargin" in stored, false);
    }
  }
});

test("repairs missing or invalid notch preferences while retaining existing choices", () => {
  for (const invalid of [undefined, null, false, 3, "diagonal", {}]) {
    storage.setItem(SETTINGS_KEY, JSON.stringify({
      language: "zh-CN",
      hideInFullscreen: false,
      codexUsageEnabled: true,
      notchEdge: invalid,
      notchVisibility: invalid,
    }));
    const loaded = loadSettings();
    assert.equal(loaded.notchEdge, "top");
    assert.equal(loaded.notchVisibility, "auto");
    assert.equal(loaded.language, "zh-CN");
    assert.equal(loaded.hideInFullscreen, false);
    assert.equal(loaded.codexUsageEnabled, true);
    const stored = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null");
    assert.equal(stored.notchEdge, "top");
    assert.equal(stored.notchVisibility, "auto");
  }
});
