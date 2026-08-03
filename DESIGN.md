---
name: Atoll
description: A quiet Windows status island for media, volume, and quick controls.
colors:
  island-dark-acrylic: "rgba(84, 84, 84, 0.80)"
  island-light-acrylic: "rgba(211, 211, 211, 0.76)"
  island-dark-card: "rgba(44, 44, 44, 0.80)"
  island-light-card: "rgba(242, 242, 242, 0.78)"
  island-dark-opaque: "#545454"
  island-light-opaque: "#d3d3d3"
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
  top-anchor: "host starts 12 DIP above the display edge"
  reef: "visible 96 × 32 DIP; host 96 × 44 DIP; 12 DIP radius"
  compact: "visible 256 × 56 DIP; host 256 × 68 DIP; 12 DIP radius"
  expanded: "visible 400 × 176 DIP; host 400 × 188 DIP; 12 DIP radius"
---

# Atoll Design System

## Intent

Atoll is a Windows status island: a small, centered, always-on-top surface that expands only when status needs attention. It borrows the interaction grammar of a compact media island—one shared shape that changes size and releases content in stages—without copying Apple artwork, icons, or hardware framing.

The visual identity is deliberately spare. The Windows Widgets-inspired Acrylic shell, Segoe typography, one mint live signal, and exact centered placement are more important than decorative material or a dense widget layout. It is a compact status surface attached to the display edge—not a miniature dashboard.

## Shell contract

| State | Geometry | Purpose |
| --- | --- | --- |
| Reef | Visible 96 × 32 DIP; native host 96 × 44 DIP, radius 12 | Persistent entry point: Atoll mark plus a small activity dot. |
| Compact | Visible 256 × 56 DIP; native host 256 × 68 DIP, radius 12 | A short status or now-playing summary. It can hold a 40 DIP cover, two ellipsized text lines, and a 34 DIP primary action. |
| Expanded | Visible 400 × 176 DIP; native host 400 × 188 DIP, radius 12 | Home, media, or settings panel. |

- Every state is top-centered on the primary display. Its full native host starts 12 DIP above the monitor, so the display edge crops the upper corners and the visible object is genuinely edge-attached rather than floated with a gap.
- Every host still owns four rounded corners. CSS clips the full rounded rectangle, and the Windows native region follows that geometry at the current DPI; only the monitor crops the upper pair, so no rectangular hit area or compositor spill is exposed.
- The host window is transparent, decorationless, non-focusable, always on top, absent from the taskbar, and has no platform shadow. The visible Island itself supplies the silhouette.
- Native sizing and centering are updated together on the same 16ms transition frame through one native Windows window transaction. The frontend releases text and controls only after the native geometry settles; do not let CSS independently reposition the Island.

## Color and material

The Island takes its material and geometry cues from the Windows Widgets Pane: one neutral Acrylic shell with quiet internal backplates. The WebView paints the material itself — a neutral translucent base with one extremely soft top reflection — clipped by the CSS radius and matching native window region, so no rectangular backing can appear outside the silhouette. Native Windows Acrylic is not used for the backdrop: its compositor paints a rectangle even into region-excluded pixels, which leaves visible corners. A transparent WebGL material layer may add one brief, neutral light sweep for expansion or a meaningful media action, then stops. Reduced-transparency mode uses the theme-appropriate opaque fallback directly.

- `#f5f7fb` / `#1c222d`: primary text in dark / light themes.
- `#c4c8d1` / `#556072`: secondary metadata and secondary transport controls.
- `#9299a7` / `#727d8f`: low-priority information and disabled states.
- Near-white in dark mode and charcoal in light mode: media progress and primary transport control.
- `#78e2d1`: the one Atoll live signal—for the Reef activity dot and keyboard focus only.
- `#545454` / `#d3d3d3`: opaque accessibility fallback in dark / light themes.
- `rgba(84, 84, 84, 0.80)` / `rgba(211, 211, 211, 0.76)`: dark / light neutral Acrylic base of the shell material. These are the visual equivalents of the Widgets Pane's `#545454 / 64%` and `#d3d3d3 / 44%` luminosity layers: the WebView cannot blur native desktop pixels behind its transparent host, so the fallback is intentionally denser to prevent desktop text from leaking through.
- `rgba(44, 44, 44, 0.80)` / `rgba(242, 242, 242, 0.78)`: quiet content backplates, with a low-contrast one-pixel border and a `0 2px 4px rgba(0,0,0,.04)` card shadow.

Do not introduce dashboard grids, broad tinted module backgrounds, ornamental glows, a separate shadow gutter, or multiple accent colors. Acrylic belongs to the one shared shell only; depth comes from its neutral tone, controlled inner reflection, and a small number of quiet card layers.

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
