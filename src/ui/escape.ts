export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeCssUrl(value: string): string {
  if (!value.startsWith("data:image/")) return "";
  return escapeHtml(value.replaceAll("\\", "\\\\").replaceAll("'", "\\'"));
}
