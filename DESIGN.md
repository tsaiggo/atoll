---
name: Atoll
description: A quiet Windows status island for media, volume, and quick controls.
colors:
  island-dark-acrylic: "rgba(24, 29, 38, 0.26)"
  island-light-acrylic: "rgba(239, 244, 251, 0.24)"
  island-dark-edge: "rgba(255, 255, 255, 0.18)"
  island-light-edge: "rgba(255, 255, 255, 0.70)"
  island-dark-opaque: "#1f232c"
  island-light-opaque: "#edf2f8"
  island-text-dark: "#f5f7fb"
  island-text-light: "#1c222d"
  island-secondary-dark: "#c4c8d1"
  island-secondary-light: "#556072"
  island-signal: "#78e2d1"
  media-emphasis: "#f5f5f7"
typography:
  family: "Segoe UI Variable Text, Segoe UI, sans-serif"
  compact-title: "12.5px / 15px"
  media-title: "14px / 16px"
  metadata: "10–10.5px"
geometry:
  top-inset: "8 DIP fixed"
  reef: "96 × 32 DIP; 16 DIP radius"
  compact: "256 × 56 DIP; 20 DIP radius"
  expanded: "400 × 176 DIP; 16 DIP radius"
---

# Atoll Design System

## Intent

Atoll is a Windows status island: a small, centered, always-on-top surface that expands only when status needs attention. It borrows the interaction grammar of a compact media island—one shared shape that changes size and releases content in stages—without copying Apple artwork, icons, or hardware framing.

The visual identity is deliberately spare. The Windows Widgets-inspired Acrylic shell, Segoe typography, one mint live signal, and exact centered placement are more important than decorative material or a dense widget layout. It is not an edge-attached card or a miniature dashboard; it is one compact status surface.

## Shell contract

| State | Geometry | Purpose |
| --- | --- | --- |
| Reef | 96 × 32 DIP, radius 16 | Persistent entry point: Atoll mark plus a small activity dot. |
| Compact | 256 × 56 DIP, radius 20 | A short status or now-playing summary. It can hold a 40 DIP cover, two ellipsized text lines, and a 34 DIP primary action. |
| Expanded | 400 × 176 DIP, radius 16 | Home, media, or settings panel. |

- Every state is top-centered on the primary display with a visible, fixed 8 DIP inset. The window is not attached to the monitor edge.
- Every state owns four rounded corners. CSS clips the content to the full rounded rectangle, and the Windows native region follows the same all-corner geometry at the current DPI so no rectangular hit area or compositor spill is exposed.
- The host window is transparent, decorationless, non-focusable, always on top, absent from the taskbar, and has no platform shadow. The visible Island itself supplies the silhouette.
- Native sizing and centering are updated together on the same 16ms transition frame through one native Windows window transaction. Keep both values in the same native transition; do not let CSS independently reposition the Island.

## Color and material

The Island takes its material and geometry cues from the Windows Widgets Board: a rounded Acrylic shell with quiet internal backplates. The WebView paints the material itself — the theme Acrylic base color, a subtle top reflection, and a one-pixel lower contour — clipped by the CSS radius and the matching native window region, so no rectangular backing can appear outside the silhouette. Native Windows Acrylic is not used for the backdrop: its compositor paints a rectangle even into region-excluded pixels, which leaves visible corners. A transparent WebGL material layer may add one brief, neutral light sweep for expansion or a meaningful media action, then stops. Reduced-transparency mode uses the theme-appropriate opaque fallback directly.

- `#f5f7fb` / `#1c222d`: primary text in dark / light themes.
- `#c4c8d1` / `#556072`: secondary metadata and secondary transport controls.
- `#9299a7` / `#727d8f`: low-priority information and disabled states.
- Near-white in dark mode and charcoal in light mode: media progress and primary transport control.
- `#78e2d1`: the one Atoll live signal—for the Reef activity dot and keyboard focus only.
- `#1f232c` / `#edf2f8`: opaque accessibility fallback in dark / light themes.
- `rgba(24, 29, 38, 0.26)` / `rgba(239, 244, 251, 0.24)`: dark / light Acrylic base of the shell material.
- Translucent white or neutral overlays: internal raised and hover surfaces only.

Do not introduce dashboard grids, broad tinted module backgrounds, ornamental glows, a separate shadow gutter, or multiple accent colors. Acrylic belongs to the one shared shell only; depth comes from its translucent tone, controlled inner reflection, and a small number of neutral tonal steps.

## Typography and content density

Use `Segoe UI Variable Text`, then `Segoe UI`, then `sans-serif`. Media and status copy is single-line and ellipsized; no marquee or permanent scrolling text is allowed. Primary media titles use 14/16, compact titles use 12.5/15, and metadata stays near 10–10.5px.

The media cover is an anchor rather than decoration: 40 × 40 DIP in Compact and Home, 52 × 52 DIP in Expanded, all with a 6 DIP radius and a subtle inset edge. In Expanded Media, previous/next are quiet 36 DIP circles and the theme-appropriate primary play/pause control is 44 DIP. Keep unavailable commands visible but subdued and non-actionable.

## Expanded panels

Expanded has exactly three contexts:

- **Home:** Atoll identity, inline system volume, a settings affordance, and the current media summary.
- **Media:** cover and two-line metadata, optional progress, previous/play-next transport, and source feedback.
- **Settings:** Chinese/English language selection and the fullscreen-hide switch. Settings remain deliberately short.

Controls use authored outline icons, explicit accessible labels, visible keyboard focus, and tabular numerals for changing time or volume. A context menu remains available from secondary click.

## Behavior

- Reef opens to Expanded only on click; hover is visual feedback only.
- A meaningful track change or system-volume update may open the relevant Expanded panel. Manual hide and fullscreen suppression take priority.
- Expanded collapses after the configured idle interval (7 seconds by default). Pointer-down, mouse-wheel activity, keyboard activity, and in-panel actions refresh that interval. A pending media command also prevents a premature collapse.
- Clicking the non-action area of an expanded Island collapses it; Escape collapses it as well.
- On collapse, ordinary idle content returns to Reef rather than leaving a shrunken media card on screen.

## Motion

The outer shape is native, not a CSS scale effect. Width, height, and corner radius follow the same smoothstep curve at 16ms target frames: expansion uses 15 frames (about 240ms) and contraction uses 11 (about 176ms). Each Windows frame applies size and centered position together in one native compositor transaction, reuses the captured monitor metrics, and is scheduled against the original transition deadline so frame work cannot accumulate into a slower cadence. A newer shell request invalidates an older native transition before it can write another frame.

Content follows the established Widgets-Acrylic volume instead of racing the geometry: Compact reveals its cover/copy/actions after short 56–104ms offsets; Expanded releases header, body, controls, and footer in a 56–120ms sequence. The Compact-to-Expanded media path treats the cover as the shared visual anchor with a 236ms transform; collapse gives the Reef mark one short 120ms settle. Ordinary metadata and progress updates must not replay an entrance animation. `prefers-reduced-motion` shortens animations and transitions to a near-instant state change.

## Guardrails

Do:

- Preserve the three shell sizes, full-corner geometry, and top-center inset unless the native region and CSS are changed together.
- Make one content hierarchy readable at a glance, with one primary action at most.
- Reserve mint for Reef activity and keyboard focus; media playback itself is neutral black and white.
- Keep theme changes in place without stealing focus or changing the user’s current panel.

Do not:

- Reintroduce edge attachment, lower-only corners, a full Widgets Board grid, or a visible rectangular host behind the Island.
- Copy Apple product artwork, use a notch frame, or present Atoll as a macOS feature.
- Add dashboard rows, timer surfaces, permanent motion, glow effects, or scrolling titles.
- Change shell geometry in CSS without updating the native `SHELL_GEOMETRY` request and Windows region behavior.
