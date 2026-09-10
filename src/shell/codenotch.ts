// Codenotch Design.swift / NotchLayout.swift, MIT (THIRD_PARTY_NOTICES.md).
// Measurements from the reference frame: the 117 px ring is 44 DIP.
const px = (n: number): number => n * 44 / 117;
export const CODENOTCH = {
  ring: 44, track: px(15.5), progress: px(8), glyph: px(46),
  labelGap: px(26.9), labelFont: px(27) / 0.714, labelLine: 17,
  sideDepth: px(186), curl: px(103), corner: px(78.8),
  padStart: px(69.5), padEnd: px(50.1), spacing: px(83.5),
  pillDepth: px(26), pillLength: px(210), pillHotZone: px(90),
  orb: px(124), orbHotZone: px(152), orbStroke: px(18), orbGap: px(27), orbGlyph: px(56),
  cardWidth: px(600), cardCorner: px(49.5), cardPadding: px(32),
  tailLength: px(75), tailHeight: px(87), tailGap: px(28),
  barHeight: px(10.5), bodyFont: px(18) / 0.714,
} as const;

export function notchMetrics(vertical: boolean, count = 3) {
  const c = CODENOTCH;
  const cellHeight = c.ring + c.labelGap + c.labelLine;
  const cellAlong = vertical ? cellHeight : c.ring;
  const start = vertical ? c.padStart : (c.padStart + c.padEnd) / 2;
  const end = vertical ? c.padEnd : start;
  const depth = vertical ? c.sideDepth : c.sideDepth - c.ring + cellHeight;
  const length = 2 * c.curl + start + count * cellAlong + (count - 1) * c.spacing + end;
  const lead = c.curl + start, pitch = cellAlong + c.spacing;
  return { depth, length, lead, pitch, cellHeight, ringMargin: (c.sideDepth - c.ring) / 2,
    centers: Array.from({ length: count }, (_, i) => lead + c.ring / 2 + i * pitch) };
}
