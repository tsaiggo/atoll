# Codenotch fidelity delivery

The accepted target is a faithful port of Codenotch's UI, interaction and motion, integrated with Atoll's media, volume, battery-discharge and optional Codex features. The former Acrylic shell is superseded. This record distinguishes replicated measurements, intentional Atoll extensions and platform differences.

## Reference authority

- Repository: https://github.com/tsaiggo/codenotch
- Read-only reference checkout: `C:/Programming/codenotch`, commit `743601acd69e701131602b88082fcaeee0c2e88b`.
- Measurements and contour: `Sources/DesignSystem/Design.swift`, `Sources/Notch/NotchLayout.swift`, `SideNotchShape.swift`, `NotchPlacement.swift`.
- Motion and interaction: `NotchMotion.swift`, `NotchRootView.swift`, `Features/SettingsHandle.swift`, `ProviderRing.swift`.
- Detail geometry: `Features/TooltipCard.swift`. The actual source tail is triangular; the reference PNG's different join is not substituted for that implementation.
- Reference image: `docs/design/frame-124-hover-tooltip.png` in the source checkout.
- MIT attribution and full terms: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Requirement audit

| Requirement | Delivered implementation and evidence |
| --- | --- |
| Edge silhouette, curls and corners | `src/shell/codenotch.ts` centralizes the source 44/117 scale. `geometry.ts` preserves corner-first clamping and circular shoulders. SVG paint and Win32 regions share the sampled contour. |
| Rings and compact layout | 44 DIP rings, 5.83 track, 3.01 progress, 17.30 glyph; source gaps and separate upright side/horizontal pitches. Four Atoll modules use the same formula. |
| Details and settings handle | Common width 225.64 DIP, corner 18.62, inset 12.03; source triangular tail and gap. The settings arc becomes a gear on hover. |
| Fold/unfold | A fixed transparent host holds full-size content while the silhouette changes. One compositor updates native regions and SVG frames; it no longer resizes the host before revealing content. |
| Motion | Source response/damping: unfold .42/.78, content .36/.82, glide .5/.86, reading .9/.9; 45 ms stagger capped at 180, 160 ms crossfade, 200 ms merge, finite 950 ms refresh. Reduced motion settles directly. Interrupted transitions resume from the displayed geometry. |
| Hover and pin | Ring hover inspects; blank rail click pins/unpins; Codex click refreshes when enabled; settings opens and pins on click. Pointer reconciliation survives DOM replacement. Folded pill retains the source inward wake band. |
| Atoll integration | Existing media capability checks, volume editing, battery-discharge history and two actual Codex windows remain connected. Missing data are explicit. Codex remains disabled until the user enables it. |
| Four native edges | Work-area centering and anchoring, shaped regions, transparent space and no-activation/tool-window/topmost flags verified on Windows at actual 150% DPI. |
| Design and documentation | DESIGN.md, PRODUCT.md, design sidecar and surface brief, architecture, both READMEs and attribution reflect this implementation. |

## Verification on 2026-09-08

- Frontend: 43 tests passed; TypeScript and Vite production build passed.
- Rust: 58 tests passed with `cargo test --locked`; `cargo fmt --check` and `cargo clippy --locked --all-targets -- -D warnings` passed.
- Browser interaction: seven groups passed, including hover/dismiss, keyboard/Escape, pin/unpin, volume editing/mute, placement settings, media transport and 150%/200% browser DPR. No page errors.
- Motion: four edges captured 49-56 moving frames per opening. Rings remain 44 DIP, stagger and intermediate tooltip positions are present, dismissal leaves no ghosts or frame errors. Pure geometry tests also cover 100 state/edge transitions at 41 samples each.
- State coverage: 16 English/Chinese cases across Codex disabled/checking/unavailable/signed-out/ready, missing media/energy and muted volume; no detail overflow.
- Visual review: independent review followed by one final batch of 20 screenshots (four edges, five views). Corrected energy legend truncation and excess settings/Codex whitespace. Evidence: `artifacts/codenotch/final/`; report: `browser-report.json` in that directory.
- Other reports: `artifacts/codenotch/motion-report.json`, `state-report.json`, `native-report.json`.
- Native executable: `src-tauri/target/debug/atoll.exe`, built with `pnpm tauri build --debug --no-bundle` and tested through its embedded WebView2 rather than the development browser.
- Native hardware: one 3840 × 2160 display at 150%, work area 3840 × 2088. All four edges passed centering/anchoring, actual region hit probes, transparent-corner exclusion and window policy. The foreground window remained outside Atoll. A Wry show call that removed the tool-window flag was replaced with Windows `SW_SHOWNOACTIVATE` and explicit style preservation.

## Reproduce

Run `pnpm dev --port 1425`, then the following with Playwright available (or set `ATOLL_PLAYWRIGHT_MODULE` to its installed module path):

```powershell
node scripts/verify-notch.mjs
node scripts/verify-notch-motion.mjs
node scripts/verify-notch-states.mjs
```

`ATOLL_PREVIEW_URL` selects another development URL; `ATOLL_SCREENSHOT_DIR` selects the screenshot output. Port 1420 in this workspace belongs to a separate reference project and was not used for Atoll verification.

For the native probe, build the executable, launch that exact binary with an isolated `WEBVIEW2_USER_DATA_FOLDER` and `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9238`, and record its process ID in `artifacts/codenotch/native-pid.txt`. Run `node scripts/verify-notch-native.mjs` with PowerShell available as `pwsh` or `ATOLL_PWSH`. The probe uses `scripts/inspect-native-window.ps1`, opts into per-monitor DPI awareness and queries the largest visible window owned by that PID. It changes placement in the isolated test profile and leaves Codex disabled. Close the test process after verification.

## Actual differences and limits

Representative review screenshots (labeled synthetic preview data):
[top media](images/codenotch/top-expanded-media.png),
[right Codex](images/codenotch/right-expanded-codex.png),
[left energy](images/codenotch/left-expanded-energy.png),
[bottom settings](images/codenotch/bottom-settings.png).

- Windows uses Segoe UI/WebView2 instead of macOS SF/SwiftUI. Label line height is 17 DIP; text rasterization and spring frame scheduling can differ. This is not a claim of identical pixels or identical native physics under every interruption.
- SVG and native regions approximate each quarter circle with 12 segments (less than 0.1 DIP geometric deviation at the source radius). Shared samples keep paint and input boundaries consistent.
- Atoll has four functional modules instead of the reference screenshot's three providers. Media, volume and energy controls are Atoll extensions. Settings is 360 × 320 DIP; Home/Sources is 300 × 210; common details retain source width with content-specific heights.
- The folded pill wake band, settings hot zone and narrow inter-surface pointer corridors intentionally accept input beyond painted pixels. Other transparent host space passes through.
- Native runtime verification covers this single 150% display. Other scales and negative-coordinate/work-area cases have automated coverage, but physical multi-monitor transitions were not exercised. Browser DPR is not a substitute for those hardware checks.
- Screenshots use explicitly labeled synthetic preview data. Native smoke verifies the shell and consent defaults; it does not certify every third-party player's behavior or enable a real Codex account.
