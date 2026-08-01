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

const paths: Record<IconName, string> = {
  atoll:
    '<ellipse cx="12" cy="12" rx="8.2" ry="5.4"/><path d="M18.8 8.9c1.2.7 1.9 1.8 1.9 3.1 0 3.5-3.9 6.4-8.7 6.4S3.3 15.5 3.3 12 7.2 5.6 12 5.6"/>',
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
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${accessible}>${paths[name]}</svg>`;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
