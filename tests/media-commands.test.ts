import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const commandsUrl = new URL("../src/features/media/commands.ts", import.meta.url).href;
const domainUrl = new URL("../src/domain.ts", import.meta.url).href;
const i18nUrl = new URL("../src/i18n.ts", import.meta.url).href;
const moduleHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === commandsUrl && specifier === "../../domain") {
      return { shortCircuit: true, url: domainUrl };
    }
    if (context.parentURL === commandsUrl && specifier === "../../i18n") {
      return { shortCircuit: true, url: i18nUrl };
    }
    return nextResolve(specifier, context);
  },
});
const {
  mediaSeekEnabled,
  normalizeMediaSeekPosition,
  optimisticMediaSeek,
} = await import("../src/features/media/commands.ts");
moduleHooks.deregister();

const SEEKABLE_MEDIA = {
  title: "Blue Hour",
  artist: "Maya Chen",
  source: "Atoll Demo",
  playing: true,
  canPrevious: true,
  canPlayPause: true,
  canNext: true,
  canSeek: true,
  positionMs: 73_000,
  durationMs: 232_000,
  positionUpdatedAtMs: 1_000,
  sessionRevision: 7,
};

test("only enables seek for a published, usable timeline", () => {
  assert.equal(mediaSeekEnabled(SEEKABLE_MEDIA), true);
  assert.equal(mediaSeekEnabled({ ...SEEKABLE_MEDIA, canSeek: false }), false);
  assert.equal(mediaSeekEnabled({ ...SEEKABLE_MEDIA, durationMs: 999 }), false);
  assert.equal(mediaSeekEnabled({ ...SEEKABLE_MEDIA, durationMs: undefined }), false);
});

test("normalizes a seek request within the active timeline", () => {
  assert.equal(normalizeMediaSeekPosition(SEEKABLE_MEDIA, 90_400), 90_400);
  assert.equal(normalizeMediaSeekPosition(SEEKABLE_MEDIA, -1), 0);
  assert.equal(normalizeMediaSeekPosition(SEEKABLE_MEDIA, 300_000), 232_000);
  assert.equal(normalizeMediaSeekPosition({ ...SEEKABLE_MEDIA, canSeek: false }, 90_000), null);
  assert.equal(normalizeMediaSeekPosition(SEEKABLE_MEDIA, Number.NaN), null);
});

test("optimistically reanchors timeline progression at the selected position", () => {
  assert.deepEqual(optimisticMediaSeek(SEEKABLE_MEDIA, 90_000, 12_345), {
    ...SEEKABLE_MEDIA,
    positionMs: 90_000,
    positionUpdatedAtMs: 12_345,
  });
});
