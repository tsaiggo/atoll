---
name: Atoll
description: Your status, surfaced.
colors:
  reef-black: "#0b0d10"
  raised-basin: "#15181d"
  soft-basin: "#1b1f25"
  foam-white: "#f5f7fa"
  mist-text: "#abb4c0"
  quiet-slate: "#78828e"
  tide-mint: "#65d6c5"
  tide-mint-bright: "#81e3d4"
  tide-ink: "#071511"
  timer-sand: "#e6bd68"
  coral-finished: "#f07b6d"
  edge-catchlight: "rgba(255, 255, 255, 0.11)"
  meter-track: "#353b43"
  completion-muted: "#d8aaa4"
  completion-ink: "#2a0e0a"
  switch-track: "#353b44"
  switch-thumb: "#d8dde4"
  light-reef: "#f2f5f4"
  light-raised-basin: "#ffffff"
  light-soft-basin: "#e6ece9"
  light-foam: "#14201d"
  light-mist: "#4f625d"
  light-tide: "#16786c"
typography:
  display:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 620
    lineHeight: 1.33
    letterSpacing: "-0.012em"
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "9.5px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  timer-compact:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 620
    lineHeight: 1
    letterSpacing: "-0.025em"
  completion:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  control:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "10.5px"
    fontWeight: 620
    lineHeight: 1.2
    letterSpacing: "normal"
  value:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  tiny:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "9.5px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  hairline: "2px"
  tide-line: "3px"
  small: "8px"
  preset: "9px"
  control-soft: "10px"
  control: "11px"
  medium: "12px"
  card: "14px"
  compact-radius: "22px"
  expanded-radius: "24px"
  reef: "0 0 12px 12px"
  compact: "0 0 22px 22px"
  expanded: "0 0 24px 24px"
  circle: "50%"
spacing:
  hairline: "2px"
  tight: "5px"
  control: "8px"
  standard: "12px"
  shell: "14px"
components:
  shell-compact:
    backgroundColor: "{colors.reef-black}"
    textColor: "{colors.foam-white}"
    typography: "{typography.body}"
    rounded: "{rounded.compact}"
    padding: "5px 9px 5px 7px"
    size: "188px × 44px"
  shell-expanded:
    backgroundColor: "{colors.reef-black}"
    textColor: "{colors.foam-white}"
    typography: "{typography.body}"
    rounded: "{rounded.expanded}"
    padding: "12px 14px 10px"
    size: "408px × 160px"
  button-primary:
    backgroundColor: "{colors.tide-mint}"
    textColor: "{colors.tide-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.raised-basin}"
    textColor: "{colors.mist-text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  card-media:
    backgroundColor: "{colors.raised-basin}"
    textColor: "{colors.foam-white}"
    rounded: "{rounded.card}"
    padding: "7px 8px"
  toggle-on:
    backgroundColor: "{colors.tide-mint}"
    textColor: "{colors.tide-ink}"
    rounded: "{rounded.circle}"
    size: "30px × 17px"
---

# Design System: Atoll

## Overview

**Creative North Star: "The Quiet Tide Line"**

Atoll is an edge-attached instrument that feels grown from the top of the display rather than placed on it. Its material follows the Windows app theme: near-black basins in dark mode, pale sea-glass basins in light mode, one thin tide line, and content that appears only when it earns the space. The visual system should feel native to a Windows 11 workspace without becoming a collage of system controls.

The shell is the identity. Reef, Compact, and Expanded are three expressions of one object, so changes in size precede content reflow and never resemble separate windows replacing one another. Mint is a scarce signal of life; sand marks elapsed time; coral is reserved for a completed timer that requires acknowledgement.

**Key Characteristics:**

- Edge-attached silhouettes with open top edges and rounded lower corners.
- Dense information hierarchy sized for a glance, not a dashboard.
- A single tide-line signature shared across every shell state.
- Tonal layering and ambient depth instead of bright borders.
- Authored outline icons and tabular numerals for changing values.

## Colors

The palette is a submerged neutral field with one cool living accent and two narrowly scoped semantic signals. Windows light/dark preference is the source of truth and changes must repaint in place without rebuilding or focusing the window. Light mode uses deeper teal, sand, and coral values so semantic controls retain contrast instead of merely inverting the dark palette.

### Primary

- **Tide Mint:** The brand signal for the tide line, active controls, focus outlines, and selected states. Its brighter partner is hover-only.

### Secondary

- **Timer Sand:** Running and paused timer information only; it never competes with the main brand accent.
- **Coral Finished:** Sticky completion states and their acknowledgement control.

### Neutral

- **Reef Black:** The continuous outer shell.
- **Raised Basin:** Interactive rows, media controls, and secondary buttons.
- **Soft Basin:** Gentle hover and nested-control separation.
- **Foam White:** Primary text and high-confidence values.
- **Mist Text:** Supporting labels and metadata.
- **Quiet Slate:** Low-priority hints and shortcut labels.
- **Light Reef:** A pale green-gray outer shell with white raised basins, dark foam text, and an inset edge that remains legible against light desktop content.

**The One Tide Rule.** Mint should remain a minority of the visible surface; use it to explain state, not to decorate empty space.

**The Semantic Shore Rule.** Sand means time in progress and coral means completion. Do not reuse either as a general-purpose accent.

## Typography

**Display Font:** Segoe UI Variable Text (with Segoe UI and sans-serif fallbacks)
**Body Font:** Segoe UI Variable Text (with Segoe UI and sans-serif fallbacks)

**Character:** The family keeps Atoll aligned with Windows while variable weights and tight negative tracking give changing status values a deliberate instrument-like quality.

### Hierarchy

- **Display:** Used only for the Expanded timer value; tabular numerals prevent width jitter.
- **Title:** Product, settings, and panel titles.
- **Body:** Compact primary text, media titles, and action labels.
- **Label:** Artists, sources, state descriptions, and tertiary controls.

**The One-Glance Rule.** Compact text is always single-line and ellipsized; Atoll never uses a permanent marquee.

## Layout

Atoll is anchored to the physical top-center of the primary display. Its nominal shells are Reef at 80 × 12 DIP, Compact at 188 × 44 DIP, and Expanded at 408 × 160 DIP. The top edge stays visually open while the lower corners carry the silhouette.

Expanded uses three short rows—header, one task area, footer—with no more than three major operation groups. Internal spacing follows a tight 2/5/8/12/14 rhythm. Album art and state glyphs occupy the leading edge; the highest-value action sits at the trailing edge or the optical center.

The native host, not CSS media queries, owns display scaling and repositioning. Content must remain clipped and legible at 125%, 150%, and 200% scaling, including on displays with negative desktop coordinates.

## Elevation & Depth

Atoll uses a hybrid of tonal layering and one ambient shell shadow. Nested surfaces are differentiated primarily by Reef Black, Raised Basin, and Soft Basin. A faint internal top highlight keeps the object legible against dark windows without creating a game-HUD border.

### Shadow Vocabulary

- **Ambient Shell:** `0 12px 34px rgba(0, 0, 0, 0.42)` gives the floating shell quiet separation from the application below.
- **Top Catchlight:** `inset 0 1px rgba(255, 255, 255, 0.08)` describes the upper material edge.

**The Basin Rule.** Add depth by changing surface tone before adding another shadow.

## Shapes

The top edge is flush to the display and the lower edge is generously rounded. Reef uses the smallest lower-corner curve, Compact reads as a shallow hanging capsule, and Expanded retains the same geometry at card scale. Nested cards use softened rectangles; transport and status glyphs may be circular when their action is atomic.

The logo is a sturdy incomplete elliptical ring with negative space. It must remain recognizable at tray scale and should never be replaced by a detailed illustration or a thin decorative orbit.

## Components

### Buttons

- **Shape:** Compact rounded rectangles for text actions; circles for transport controls.
- **Primary:** Tide Mint with Tide Ink, reserved for the most likely action.
- **Secondary:** Raised Basin with Mist Text; hover lifts the tone and text contrast.
- **Hover / Focus:** Hover uses color and tonal shifts only. Keyboard focus uses a two-pixel Tide Mint inset outline.

### Chips

- **Style:** Timer state and segmented settings use small tonal chips with concise labels.
- **State:** Selected settings invert to Tide Mint and Tide Ink; timer status remains sand-on-transparent-sand.

### Cards / Containers

- **Corner Style:** Generous nested-card curve.
- **Background:** Raised Basin at rest, Soft Basin or a slightly brighter neutral on hover.
- **Shadow Strategy:** No nested shadows.
- **Internal Padding:** Tight, vertically centered spacing suited to the fixed-height shell.

### Atoll Shell

Reef, Compact, and Expanded share the outer color, tide-line signature, top attachment, and lower-corner grammar. Native window resizing drives the silhouette; content is re-rendered inside the same surface. Same-shape status updates—especially volume—must not replay the shell transition.

### Media Transport

Previous and Next are quiet circular controls. Play/Pause is larger and uses the primary treatment. Unsupported transport commands remain visible only when their absence would not mislead; otherwise they are disabled with reduced opacity.

### Settings Toggle

The switch is a short dark track with a solid circular thumb. The on state uses a translucent mint track and mint thumb; the label remains neutral so multiple enabled settings do not create a wall of accent color.

## Do's and Don'ts

### Do:

- **Do** let the tide line and shell transformation carry the brand.
- **Do** keep the most important value readable in a peripheral glance.
- **Do** use tabular numerals for time and percentage changes.
- **Do** update content in-place when the shell size does not change.
- **Do** follow the live Windows app theme without changing window geometry, focus, or current state.
- **Do** preserve a clear icon, label, or shape cue in addition to semantic color.

### Don't:

- **Don't** turn Expanded into a dashboard or add a fourth content row.
- **Don't** use permanent scrolling text, pulsing glows, or decorative idle animation.
- **Don't** round the top corners into a detached Apple-style pill.
- **Don't** mix icon families or substitute text glyphs for product icons.
- **Don't** add borders and shadows to every nested surface.
