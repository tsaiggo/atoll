# Atoll design QA

## Comparison target

- Source visual truth: `C:\Programming\atoll\DESIGN.md`
- Windows widget geometry reference: `C:\Programming\atoll\artifacts\design-qa\official-windows-widget-sizes-2026-07-31.png`
- Native implementation: `C:\Programming\atoll\artifacts\design-qa\native-expanded-corner-safe-mask-exact-150.png`
- 150% CSS corner baseline: `C:\Programming\atoll\artifacts\design-qa\browser-expanded-css-150pct-corner-baseline.png`
- User-reported regression: `C:\Programming\atoll\artifacts\design-qa\user-reported-system-acrylic-rectangle.png`
- Browser state captures:
  - `C:\Programming\atoll\artifacts\design-qa\browser-expanded-media-light-384x148.png`
  - `C:\Programming\atoll\artifacts\design-qa\browser-expanded-media-dark-384x148.png`
  - `C:\Programming\atoll\artifacts\design-qa\browser-expanded-home-light-384x148.png`
  - `C:\Programming\atoll\artifacts\design-qa\browser-expanded-settings-light-384x148.png`
  - `C:\Programming\atoll\artifacts\design-qa\browser-expanded-timer-light-384x148.png`
  - `C:\Programming\atoll\artifacts\design-qa\browser-expanded-finished-light-384x148.png`
  - `C:\Programming\atoll\artifacts\design-qa\browser-compact-media-light-188x44.png`
  - `C:\Programming\atoll\artifacts\design-qa\browser-compact-media-dark-188x44.png`

## Normalization

- Expanded CSS viewport: `384 × 148 DIP`
- Expanded native window: `576 × 222 physical px`
- Native density: Windows `144 DPI` / `150%`
- Browser expanded capture: `384 × 148` at device scale factor `1`
- Compact CSS viewport: `188 × 44 DIP`
- Compact native window after timeout: `282 × 66 physical px`
- Compact browser capture: `188 × 44` at device scale factor `1`
- States: Home, Media, Settings, Timer, Timer Finished, plus Compact media in light and dark themes
- The comparison crops contain the component only; no browser chrome or desktop frame is included.

## Findings

No actionable P0, P1, or P2 visual differences remain.

- Fonts and typography: production uses the approved `Segoe UI Variable Text` stack. Figma used Inter only as an editable-account fallback. Weight, size, line height, truncation, and hierarchy match the intended production specification.
- Spacing and layout rhythm: Expanded is `384 × 148 DIP` with a `16 DIP` horizontal inset, exact per-panel row tracks, and a `12 DIP` lower radius. Nested rectangular surfaces use `8 DIP`; circular transport controls remain circular. Compact preserves Atoll's `188 × 44 DIP / r22` identity.
- Colors and visual tokens: the shell uses the WinUI Acrylic fallback color, `CardBackgroundFillColorDefault`, and one `CardStrokeColorDefault` contour. Tide mint is limited to progress and active-state glyphs. Raised controls remain neutral in both themes.
- Image quality and asset fidelity: album art remains a real Windows media-session asset and is masked at the intended radius. The native QA demo intentionally exercises the existing Atoll fallback; `native-top-current.png` separately confirms real-session artwork rendering. The reference artwork is not substituted with CSS or a handcrafted asset.
- Copy and content: track, artist, source, and playback times are dynamic media-session values. The differing demo copy does not alter layout or hierarchy.
- Icons and affordances: source transport and gear icons retain the existing Atoll icon set, consistent stroke weight, alignment, labels, focus rings, disabled state, and press feedback.
- Accessibility: semantic buttons and progressbar labels remain intact; light and dark foreground tokens retain readable contrast; reduced-motion behavior is unchanged.
- Focused region comparison: the exact `576 × 222` native component crop is readable at 1:1 and proves the Windows 150% endpoint without a hand-estimated crop.

## Comparison history

1. Initial implementation audit
   - Earlier P1: primary playback controls were solid mint, the shell was opaque, and the media footer read as a utility toolbar.
   - Fixes: enabled native Acrylic with an 88% theme tint, changed transport controls to neutral raised surfaces with mint glyphs, reduced the gear treatment, and restored the quiet source-dot footer.

2. First post-implementation review
   - Earlier P1: removing the footer utility content also removed temporary expanded-state volume feedback.
   - Earlier P1: native Acrylic and CSS `backdrop-filter` could be composed together in the Tauri runtime.
   - Earlier P2: compact-to-expanded native corner radius changed abruptly.
   - Fixes: the footer now temporarily renders the existing volume meter when volume changes; `.native-runtime` disables the CSS blur fallback; the native radius now interpolates from `22` to `24 DIP` during resize.

3. Final visual pass
   - Post-fix evidence: `comparison-expanded-reference-current.png`
   - Expanded and compact light/dark captures showed no content clipping, overlap, or density drift.
   - This pass was incomplete: its neutral wallpaper did not make the native backing outside the CSS radius visible, so its earlier “passed” conclusion was invalidated by the user screenshot.

4. Native compositor regression and correction (superseded by item 8)
   - P1 found: Tauri/window-vibrancy selected Windows 11 `DWMWA_SYSTEMBACKDROP_TYPE`, which painted Acrylic to the rectangular HWND bounds even though `SetWindowRgn` still held the correct complex region.
   - Root-cause evidence: the reported screenshot shows the CSS shell rounding correctly while the native material remains rectangular; direct `GetWindowRgn` / `PtInRegion` probes confirmed the lower corner was already excluded from the region.
   - Fix: removed the system-backdrop configuration and applied `ACCENT_ENABLE_ACRYLICBLURBEHIND` dynamically after native window policy setup. This Acrylic path follows the Atoll window region; unsupported systems fall back to the existing theme tint without blocking launch.
   - Post-fix evidence: `native-expanded-region-aware-acrylic-crop.png`, `native-compact-region-aware-acrylic-crop.png`, and the high-contrast blue-underlay proof `native-expanded-region-aware-acrylic-colored-underlay.png`.

5. Windows widget geometry refinement
   - Superseded geometry: Expanded `408 × 160 DIP / r24` and oversized `r14` nested cards.
   - Current geometry: Expanded `384 × 148 DIP / r12`, `16 DIP` horizontal inset, and `r8` nested rectangular controls; Compact remains `188 × 44 DIP / r22`.
   - Home rows: `32 / 44 / 32 / 24`; Media: `44 / 64 / 24`; Settings: `32 / 100`; Timer: `44 / 64 / 24`; Timer Finished: `38 / 50 / 44`.
   - The native region now interpolates continuously from Compact `r22` to Expanded `r12`, keeping CSS and hit-test silhouettes aligned.
   - Post-fix evidence: all `384 × 148` browser captures plus `native-expanded-windows-geometry-384x148.png`.

6. Native corner edge completion (superseded)
   - P2 found: the binary GDI region clipped the outer antialiased CSS curve by one to two visible physical pixels at the lower corners. At 150%, the final scanline entered the shell at `x=17` instead of the CSS edge at `x=12`.
   - Earlier fix: the GDI bottom exclusive bound was extended from `physical_height + 1` to `physical_height + 2`. A later full-perimeter audit showed this still clipped side-to-curve pixels and could expose Acrylic during animation.
   - Post-fix evidence: the 150% final scanline now begins a smooth shell transition at `x=12`; the square corner pixels at `x=0` and `x=575` remain outside the region.
   - Captures: `native-expanded-corner-safe-mask-exact-150.png` and `native-expanded-corner-safe-mask-blue-confirmed-150.png`.

7. Fluent Card material and exact perimeter
   - Replaced the 88% green-gray shell tint with the official WinUI Light/Dark Card fill and one Card contour.
   - Disabled DWM's border, automatic corners, and system backdrop so no rectangular or second native frame can appear behind the Atoll silhouette.
   - CSS and native code now share each shell's target radius. Native animation frames use the same effective radius constraint as CSS instead of deriving a different radius from intermediate height.
   - Replaced `CreateRoundRectRgn` offset patches with symmetric scanline bands calibrated to Chromium's visible pixel coverage at 100%, 125%, 150%, and 200% scaling.
   - Final 150% live audit: Expanded and Compact both report `CSS ∖ HRGN = 0` and `HRGN ∖ CSS(alpha=0) = 0`.
   - Captures: `native-fluent-material-expanded-final-150.png` and `native-fluent-material-compact-final-150.png`.

8. Rectangular Accent Acrylic elimination
   - P1 found from the user's marked screenshot: the CSS radius and HRGN were already pixel-aligned, but `ACCENT_ENABLE_ACRYLICBLURBEHIND` still painted its own rectangular compositor visual into pixels excluded by the HRGN.
   - Pixel proof: the reported corner was approximately `#424243`; the shell interior was `#C7C7C7`, exactly the result of the 70.2% light Card fill over that raw Accent backing. A blue-underlay audit likewise showed excluded corner pixels tinted by Accent instead of matching the underlay.
   - Fix: removed top-level Accent Acrylic. Native Atoll now uses the official theme Acrylic fallback color beneath the official Card fill and contour, all clipped by the CSS radius; HRGN remains the matching hit-test/window perimeter.
   - First frame is completed synchronously through resize, show, and final `SetWindowRgn`, so native failures return to the frontend instead of leaving an accepted rectangular shell.
   - Regression coverage: Compact and Expanded edge points remain symmetric at 100%, 125%, 150%, and 200%; GDI region composition failures are now checked.

9. Rectangular Accent Acrylic regression on the dark-material branch
   - The `codex/dark-acrylic-material` branch re-added `ACCENT_ENABLE_ACRYLICBLURBEHIND` (the item 8 root cause) for the dark acrylic material direction, reintroducing the angular corners.
   - Evidence: a calibrated blue-underlay probe showed the region-excluded corner dropping from pure underlay `(30,80,220)` to a warm tint `(97,129,220)` when the accent was live; a checkerboard probe showed both `ACCENT_ENABLE_BLURBEHIND` and `ACCENT_ENABLE_ACRYLICBLURBEHIND` painting a rectangular layer into region-excluded corners (corner `(0,0)` read a blurred mid-gray instead of pure black/white). No WCA accent state respects the HRGN.
   - Fix: removed `apply_acrylic_blur` from `shell.rs` and the `.native-runtime` CSS override from `styles.css`, so native uses the same rounded CSS backdrop material (fallback Acrylic color + gradients + contour), clipped by `border-radius` and the matching HRGN — the item 8 resolution.
   - Verification: reef and expanded live blue-underlay probes reported all region-excluded corner pixels clean; the COMPLEX region traces the ideal corner circle; `cargo test` (25) and frontend tests (8) pass.

## Functional and build checks

- Primary interaction tested: Pause changes to Play in the browser preview.
- Browser console warnings/errors: none.
- Auto-collapse: after the configured seven-second Expanded timeout, the native window settled to the exact `282 × 66 physical px` Compact endpoint at 150%.
- Repeated-state stress: eight rapid single-instance expand requests left exactly one Atoll process and settled to the same Compact endpoint after timeout.
- Native region probe after stress: `COMPLEXREGION`; the six measured CSS edge points are included while both bottom square-corner pixels remain excluded.
- Browser geometry: every tested shell and panel reported matching client/scroll dimensions; no clipping or overflow remained. Timer's Segoe UI numeric line box was measured and given one explicit pixel of breathing room.
- Impeccable terminal detector: clean after the final material change.
- `pnpm build`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 20 passed, 0 failed, including cross-DPI region symmetry, target-radius synchronization, first/last animation geometry, and 150% CSS-edge containment tests.
- `cargo build --manifest-path src-tauri/Cargo.toml`: passed and produced the final native executable.

final result: passed
