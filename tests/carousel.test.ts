import assert from "node:assert/strict";
import test from "node:test";

import {
  availableCarouselCards,
  reconcileCarouselCard,
  stepCarouselCard,
} from "../src/features/surface/carousel.ts";

test("builds stable media then timer card order", () => {
  assert.deepEqual(availableCarouselCards(true, true), ["media", "timer"]);
  assert.deepEqual(availableCarouselCards(false, true), ["timer"]);
  assert.deepEqual(availableCarouselCards(true, false), ["media"]);
});

test("preserves the selected card while it remains available", () => {
  assert.equal(reconcileCarouselCard(["media", "timer"], "timer", "media"), "timer");
});

test("falls back to the preferred available card", () => {
  assert.equal(reconcileCarouselCard(["media", "timer"], null, "timer"), "timer");
  assert.equal(reconcileCarouselCard(["media"], "timer", "timer"), "media");
  assert.equal(reconcileCarouselCard([], "media", "media"), null);
});

test("steps in both directions and wraps", () => {
  const cards = ["media", "timer"] as const;
  assert.equal(stepCarouselCard(cards, "media", "next"), "timer");
  assert.equal(stepCarouselCard(cards, "timer", "next"), "media");
  assert.equal(stepCarouselCard(cards, "media", "previous"), "timer");
  assert.equal(stepCarouselCard(cards, null, "previous"), "timer");
  assert.equal(stepCarouselCard(["media"], "media", "next"), "media");
  assert.equal(stepCarouselCard([], null, "next"), null);
});
