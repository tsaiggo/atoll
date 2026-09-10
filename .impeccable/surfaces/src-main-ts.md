---
version: 1
slug: "src-main-ts"
primary_target: "src/main.ts"
related_targets: ["src/styles.css", "src/ui/notch.ts", "src/ui/notch-motion.ts", "src/ui/expanded.ts", "src/shell/codenotch.ts", "src/shell/geometry.ts", "src/shell/motion.ts"]
---

Scope: Atoll's four-edge Windows desktop shell, including Hidden, Reef, status rail, focused details and existing management controls. Mode: Operate.

Audience and job: A Windows user checks or acts on media, battery-discharge energy or opted-in Codex usage without leaving the current task. Inspect by hover, pin by clicking blank rail space, and recover through keyboard, tray or context menu.

Visual authority: The user explicitly selected faithful Codenotch reproduction, superseding the previous Widgets-Acrylic and mint tide-line shell. Pure black arc-derived contours, 44-DIP status rings, reference spacing, a separate settings arc/gear and a module-aligned detail tail are binding. Atoll's approved Floating Island application artwork and monochrome capsule glyph are specified separately in `assets-atoll-icon-svg.md`.

Composition: Top/bottom use three upright horizontal rings; left/right use three upright vertical rings. A fixed transparent native host reserves detail and overshoot room. One frame compositor presents SVG arcs and sampled Win32 regions from common geometry, with a two-physical-pixel antialias fringe and intentional pointer corridors. The canvas retains measured DIP dimensions at fractional display scales. Reef is approximately 78.97 × 9.78 DIP. Common details are approximately 225.64 DIP wide; media/Codex are 176 high, energy 320. Settings (360 × 320) and Home/Sources (300 × 210) are Atoll extensions to preserve existing capabilities.

Interaction: Ring hover and keyboard navigation inspect details. Blank-rail click pins/unpins; enabled Codex click refreshes actual local usage; settings click pins its management view. Settings preserves Chinese/English, top/bottom/left/right, automatic/always-visible and fullscreen hiding. Leaving an unpinned surface lets it recede; pending controls and intentional pinned management work stay protected.

Data truth: Media progress requires a real duration and seeking requires published capability. Energy means measured battery discharge and never implies wall power or battery charge. Its 30-calendar-day window includes today, with rows for today so far, recorded period total, peak recorded day and recorded/partial-day coverage. Thirty bars preserve missing-day gaps, 2px recorded-zero marks and dashed caps on partial records; recorded dates support click and keyboard selection. Values use Wh below 1000 Wh and kWh/度 at or above it, with mWh for positive values below 10 mWh. Codex begins disabled; its Enable action is the consent boundary. At most two ranked actual windows show used percentage and locally calculated reset time. Green/yellow/orange bands represent below 50%, below 70% and 70% or higher usage. No prompts, files, account identifiers, API keys, raw App Server payloads or reset-credit action reach this surface.

Motion: Reference unfold (0.42/0.78), content (0.36/0.82; 45ms stagger capped at 180ms), glide (0.5/0.86), reading (0.9/0.9), 160ms crossfade and finite 950ms Codex refresh. Reduced motion settles directly. Outgoing visual ghosts are inert.

Ingredient inventory:
- Shared measured constants, sampled arc geometry, SVG paint and native polygon regions.
- Semantic HTML controls, inline authored glyphs, real player artwork and compact Segoe typography.
- Sanitized Tauri media/energy/Codex snapshots; sample values only in labeled development previews.
- Existing Atoll management, consent and recovery copy.

Validation boundary: This brief records implemented visual and interaction contracts. Native no-activation, display-change and input-region outcomes belong to runtime verification, not unverified design claims. Daily Codex token activity has no visual treatment.
