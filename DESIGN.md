---
name: Atoll
description: A Windows edge notch for measured status and immediate controls.
colors:
  shell-black: "#000000"
  reading-white: "#FFFFFF"
  ring-track: "#303030"
  usage-track: "#2D2D2D"
  secondary-text: "#B3B3B3"
  quiet-text: "#999999"
  control-surface: "#1C1C1C"
  control-hover: "#2C2C2C"
  usage-green: "#00FF88"
  usage-yellow: "#F2FF00"
  usage-orange: "#FF3F00"
typography:
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "12px"
    lineHeight: "16px"
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "14.2211px"
    fontWeight: 600
    lineHeight: "17px"
  caption:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "10px"
    lineHeight: "14px"
  usage-row:
    fontFamily: "Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "9.48px"
    fontWeight: 400
    lineHeight: "12px"
rounded:
  control: "6px"
  artwork: "5px"
  detail: "18.6154px"
spacing:
  tight: "4px"
  related: "6px"
  controls: "12px"
  detail-inset: "12.0342px"
components:
  status-ring:
    width: "44px"
    height: "44px"
    textColor: "{colors.reading-white}"
  detail:
    backgroundColor: "{colors.shell-black}"
    textColor: "{colors.reading-white}"
    rounded: "{rounded.detail}"
    padding: "{spacing.detail-inset}"
  setting-option:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.control}"
    padding: "5px 9px"
  setting-option-selected:
    backgroundColor: "{colors.reading-white}"
    textColor: "{colors.shell-black}"
    rounded: "{rounded.control}"
  media-transport:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-text}"
    width: "28px"
    height: "28px"
  media-transport-primary:
    backgroundColor: "{colors.reading-white}"
    textColor: "{colors.shell-black}"
    width: "32px"
    height: "32px"
---

# Design System: Atoll

## Overview

**Creative North Star: "The Codenotch Edge"**

The user-selected Codenotch reference governs Atoll’s desktop surface: pure black silhouettes, inverse edge curls, large measured status rings and a separate settings arc. This explicitly replaces the previous Widgets-Acrylic shell and mint tide-line treatment. Atoll remains a calm Windows utility with its existing Inset Cove identity and local media, volume, battery-discharge and optional Codex capabilities.

One object moves between Reef, status rail and an attached detail bubble. The black silhouette and its spacing carry the identity; color explains measured Codex usage. Existing controls and recovery states remain accessible inside purpose-sized details. The application and notification-area artwork retain their authored graphite and mint treatment outside this monochrome shell.

**Key Characteristics:**

- Pure black edge silhouettes with inverse curls and an attached, rounded detail bubble.
- Four upright modules on every work-area edge, with measured values and stable ring spacing.
- One reference-derived motion compositor for the visible contour, native hit region and content.
- Neutral media, volume and energy presentation; colored Codex usage only when real data exists.
- Persistent settings and management views extend the reference without changing its visual grammar.

## Colors

The shell uses black, white and a short neutral ramp; the three usage colors preserve the reference’s precise meaning.

### Primary

- **Usage Green**, **Usage Yellow** and **Usage Orange** belong to actual Codex usage rings, readings and detail meters. The bands are below 50%, from 50% to below 70%, and 70% or above. At 100%, the glyph dims while the ring and reading remain visible.
- The packaged mint brand artwork remains an identity asset. It does not define the shell’s status palette.

### Neutral

- **Shell Black** paints the silhouette and detail bubble.
- **Reading White** carries primary copy, media and volume progress, and selected controls.
- **Ring Track** and **Usage Track** expose the denominator without implying a value when the signal is unavailable.
- **Secondary Text** and **Quiet Text** distinguish metadata and local reset times.
- **Control Surface** and **Control Hover** support interactive controls inside details without adding elevated cards.

**The Measured Color Rule.** Green, yellow and orange encode reported Codex used percentage. They do not decorate media, volume or battery energy, and color never replaces the numeric reading.

## Typography

**Body Font:** Segoe UI Variable Text, with Segoe UI and sans-serif fallbacks.

**Character:** One native Windows family supports a compact title, clear ring reading and quieter supporting text. There is no editorial display face or decorative monospace treatment. Percentages, times and changing measurements use tabular numerals.

### Hierarchy

- **Title:** media and recovery headings use the compact title role; established settings and management headers retain their slightly larger local hierarchy.
- **Label:** the reference-derived ring label is the strongest peripheral reading.
- **Caption:** media metadata and recovery instructions remain secondary and may wrap when comprehension requires it.
- **Usage row:** compact window labels, reset copy and percentage text form two repeatable rows. This specialized detail role is not a general minimum text size.

Titles may truncate with a complete accessible name or tooltip. Energy-history captions wrap inside their narrow detail; no permanent marquee is used.

**The Upright Reading Rule.** Docking changes the silhouette and module arrangement; labels, artwork and detail controls remain upright.

## Layout

The physical desktop work area defines the four docking edges. Top and bottom use a horizontal module sequence; left and right use a vertical sequence. A fixed transparent native host reserves room for all details and spring overshoot. Reef, rail and detail transitions change painted geometry within that host; the host rectangle is not a visible surface.

The reference proportions come from `src/shell/codenotch.ts`, using a 44-DIP ring as the calibration unit. `notchMetrics` derives depth, leading space, pitch and ring centers for the two orientations. Keep those formulas authoritative rather than reintroducing a separate CSS layout scale.

| Surface | Current logical size | Purpose |
| --- | --- | --- |
| Reef | approximately 78.97 × 9.78; rotated at side edges | Small hover and keyboard entry point |
| Common detail | approximately 225.64 wide | Reference-scale focused reading |
| Media / Codex detail | common width × 176 | Playback controls or two actual usage windows |
| Energy detail | common width × 224 | Seven-day history, wrapped caption and selected measurement |
| Volume detail | common width × 120 | Level, mute and system-volume range |
| Settings | 360 × 320 | Language, four-edge placement, visibility and fullscreen preference |
| Home / Sources | 300 × 210 | Existing Atoll management and source-selection controls |

Settings and management dimensions are intentional Atoll extensions. Overflow remains scrollable where real content requires it; same-panel updates preserve scroll position and focused controls.

## Elevation & Depth

The notch and its details have no surface shadow, Acrylic, backdrop blur or ornamental gradient. Black contours, the gap around the tail and a small neutral control vocabulary establish separation from the desktop. A range’s split fill encodes its measured value; it is not a decorative material gradient.

**The Shared Contour Rule.** SVG paint and the Windows input region consume the same sampled geometry on each animation frame. Transparent host space remains click-through except for the narrow pointer corridors.

## Shapes

Inverse edge curls and outer corners derive from the reference’s circular arcs. The same sampled polygons drive SVG and Win32 clipping. Rounded detail corners and the triangular tail belong to one continuous black painted surface. Do not replace the shared contours with unrelated border-radius approximations.

Status rings have a complete neutral track and a thinner measured signal with round endpoints. Settings rests as a quarter arc and becomes a black disc with a white gear on hover or keyboard focus.

The Inset Cove v2 mark remains the authored asymmetric reef with its left-offset lagoon counter and upper-right cove. Preserve `assets/atoll-icon.svg`, `assets/atoll-tray.svg` and their optical differences. The shell uses the glyph in current text color; the installer, Explorer and tray masters keep their graphite/mint artwork.

## Components

### Status rail

Media, volume, battery-discharge energy and Codex remain directly reachable. Media has a white progress signal only with a real duration. Volume has a white level signal and an explicit mute glyph. Energy has a neutral track and an adaptive measured unit, never a charge percentage. Disabled or unavailable Codex shows a neutral glyph and opens its consent or recovery detail.

Hovering a module inspects its detail. Clicking blank rail space pins or unpins the surface. Keyboard focus exposes explicit pin and collapse affordances; Escape, tray and shortcut remain alternate paths. Clicking enabled Codex requests a refresh; clicking settings pins its management view.

### Detail containers

The focused bubble aligns its tail with the inspected module. Its content remains at a complete layout size while the contour moves. Media retains real transport, conditional seek and source selection. Energy retains missing-day gaps, partial-record cues and selectable measurements. Codex retains at most two ranked real usage windows, local reset copy, opt-in, honest recovery and turn-off controls.

### Buttons and settings

Primary transport uses a white disc with a dark glyph; secondary transport stays quiet. Segmented setting options use a neutral border at rest and invert to white when selected. Focus remains visible and selected, unavailable and pending states have semantic attributes. The settings arc/gear change is a finite response to interaction rather than idle animation.

### Inputs

System volume and supported media seeking use native range inputs with a measured split fill, thumb and keyboard interaction. Unsupported playback commands remain disabled. Settings retain language, automatic/always-visible behavior, edge selection and fullscreen hiding.

### Motion

A single frame compositor evaluates the reference’s damped springs and shares each contour with the native region. Response values describe spring period, not fixed CSS durations: unfold uses 0.42 / 0.78 response/damping; content uses 0.36 / 0.82 with 45ms stagger capped at 180ms; detail glide uses 0.5 / 0.86; measured readings use 0.9 / 0.9. Content crossfades over 160ms. Geometry keeps its final stable rail position during detail changes.

Codex refresh has a finite 950ms rotational response. Reduced motion settles geometry and readings directly, and normal polling does not restart entrance motion. Invisible outgoing content is inert and cannot intercept input.

## Do's and Don'ts

### Do:

- **Do** derive shell geometry and ring proportions from the shared Codenotch constants.
- **Do** retain upright labels, tabular changing values and source-specific unavailable states.
- **Do** keep the detail tail aligned with the inspected module while preserving the rail position.
- **Do** respect reduced motion and keep routine snapshots from replaying entrance animation.
- **Do** preserve the Inset Cove mark, local data boundaries, Codex opt-in and complete recovery controls.

### Don't:

- **Don’t** restore Acrylic, decorative surface gradients, glow or a shadow gutter around the notch.
- **Don’t** replace missing measurements with a filled ring, a fabricated percentage or an apparent zero.
- **Don’t** turn ring color into a generic health score or battery-charge claim.
- **Don’t** resize the native host separately from the shared frame compositor to animate shell states.
- **Don’t** apply the shell’s flat-material rule to the existing authored application-icon artwork.
