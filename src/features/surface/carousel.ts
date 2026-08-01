export type CarouselCardKind = "media" | "timer";
export type CarouselDirection = "next" | "previous";

export const CAROUSEL_ADVANCE_MS = 6_000;

export function availableCarouselCards(
  hasMedia: boolean,
  hasActiveTimer: boolean,
): CarouselCardKind[] {
  const cards: CarouselCardKind[] = [];
  if (hasMedia) cards.push("media");
  if (hasActiveTimer) cards.push("timer");
  return cards;
}

export function reconcileCarouselCard(
  cards: readonly CarouselCardKind[],
  current: CarouselCardKind | null,
  preferred: CarouselCardKind | null = null,
): CarouselCardKind | null {
  if (current && cards.includes(current)) return current;
  if (preferred && cards.includes(preferred)) return preferred;
  return cards[0] ?? null;
}

export function stepCarouselCard(
  cards: readonly CarouselCardKind[],
  current: CarouselCardKind | null,
  direction: CarouselDirection,
): CarouselCardKind | null {
  if (cards.length === 0) return null;
  const currentIndex = current ? cards.indexOf(current) : -1;
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const offset = direction === "next" ? 1 : -1;
  return cards[(startIndex + offset + cards.length) % cards.length] ?? null;
}
