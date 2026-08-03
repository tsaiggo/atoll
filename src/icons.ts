type IconName =
  | "atoll"
  | "back"
  | "gear"
  | "hide"
  | "media"
  | "next"
  | "pause"
  | "play"
  | "previous"
  | "volume"
  | "volumeMute";

// The Inset Cove is a filled, compound mark rather than a stroked icon. Keep
// the source geometry in its native 160 × 160 coordinate space so the Reef,
// brand lockup, and package icon all share the same optical proportions.
const ATOLL_MARK_PATH =
  "M80 14C46 14 20 41 20 80C20 119 46 146 80 146C114 146 140 119 140 80C140 68 139 58 135 49C130 49 122 49 116 53C112 55 110 58 108 61C107 46 108 30 112 17C102 15 92 14 80 14Z M70 55C55 55 45 66 45 81C45 96 55 107 70 107C85 107 95 96 95 81C95 66 85 55 70 55Z";

const paths: Record<IconName, string> = {
  atoll:
    `<path fill="currentColor" stroke="none" fill-rule="evenodd" clip-rule="evenodd" d="${ATOLL_MARK_PATH}"/>`,
  back: '<path d="m15 18-6-6 6-6"/>',
  gear:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  hide: '<path d="M4 4l16 16M10.6 10.7A2 2 0 0 0 13.3 13.4M9.9 5.2A10.6 10.6 0 0 1 12 5c5.5 0 9 7 9 7a17 17 0 0 1-2 2.9M6.6 6.6C4.2 8.3 3 12 3 12s3.5 7 9 7c1.2 0 2.3-.3 3.3-.7"/>',
  media: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
  next: '<path d="m6 5 9 7-9 7V5Z"/><path d="M18 5v14"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m7 4 13 8-13 8V4Z"/>',
  previous: '<path d="m18 5-9 7 9 7V5Z"/><path d="M6 5v14"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
  volumeMute: '<path d="M11 5 6 9H3v6h3l5 4V5ZM16 10l5 5M21 10l-5 5"/>',
};

export function icon(name: IconName, label?: string, className = ""): string {
  const accessible = label
    ? `role="img" aria-label="${escapeAttribute(label)}"`
    : 'aria-hidden="true"';
  const viewBox = name === "atoll" ? "0 0 160 160" : "0 0 24 24";
  return `<svg class="icon ${className}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${accessible}>${paths[name]}</svg>`;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
