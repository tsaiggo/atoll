# Atoll icon: Floating Island

The user-approved Floating Island artwork places a detached horizontal black capsule on a painterly cyan, cobalt, lilac, coral and peach canvas. A cyan status light sits on the left; three short white bars sit on the right. Color remains visible around every side of the capsule. The monochrome tray and in-app glyph preserve that motif at small sizes.

[Codenotch](https://github.com/tsaiggo/codenotch) supplied painterly style inspiration. The complete approved composition was generated using an earlier generated Atoll concept as input; the exact prompt is retained with the source. The authored SVG clips the finished image's outer boundary, while the tray and in-app glyph are separately authored vector drawings. The existing upstream MIT notice remains in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). This icon delivery leaves the desktop shell's separate Codenotch layout, status palette and motion unchanged.

| Asset | Role |
| --- | --- |
| `assets/atoll-icon-paint.png` | Complete generated artwork, including unwanted exterior checkerboard that must be excluded from distribution. |
| `assets/atoll-icon-paint.prompt.txt` | Exact generation prompt for the approved composition. |
| `assets/atoll-icon.svg` | Authored rounded outer clipping boundary over the companion raster. |
| `assets/atoll-icon.png` | Transparent 1024 × 1024 RGBA distribution master, matching the approved image's decoded pixels exactly. |
| `assets/atoll-tray.svg` | Authored 24-unit dark capsule with white outline, dot and three bars. |
| `src-tauri/icons/tray-32.png` | Notification-area raster export. |
| `assets/atoll-tray-16.png` | Small-size tray export. |
| `src/icons.ts` | Current-color 24-unit capsule, dot and bars for the application UI. |
| `src-tauri/icons/icon.ico` and other Tauri exports | Packaging assets generated from the RGBA master. |

The application SVG uses a 1254 × 1254 viewBox. Its clip rectangle starts at (88, 88), measures 1076 × 1076 and has corner radius 260. The complete generated image fills the viewBox beneath that clip. The SVG excludes the exterior checkerboard; the exported icon has true alpha transparency outside the rounded tile.

The tray SVG uses a 24 × 24 viewBox. Its `#101114` capsule starts at (1, 5), measures 22 × 14 and has radius 7, with a white outline of width 1.2. The white dot is centered at (6, 12), radius 1.4. Three round-ended white bars have width 1.8: x=13 spans y=12–14, x=16 spans 9–14, and x=19 spans 10.5–14. The in-app glyph uses matching geometry in current color. These variants simplify material without changing the approved capsule, light and bars motif.

The source SVG depends on its companion bitmap. Use the exported PNG for GitHub README images and other surfaces that do not resolve relative SVG dependencies. Keep the bitmap, exact prompt and SVG together when editing the source.

Regenerate from the repository root with Node, Playwright and its Chromium browser available:

```powershell
node scripts/generate-icons.mjs
pnpm tauri icon assets/atoll-icon.png
```

If Playwright comes from an existing external runtime, set its module path first:

```powershell
$env:ATOLL_PLAYWRIGHT_MODULE = 'C:/path/to/node_modules/playwright'
node scripts/generate-icons.mjs
pnpm tauri icon assets/atoll-icon.png
```

The generator embeds the companion bitmap while rendering the SVG and exports PNGs with transparent backgrounds. The user authorized this SVG clipping and PNG/ICO export method.

To regenerate comparison boards, point the reference variable to the user-approved image:

```powershell
$env:ATOLL_ICON_REVIEW = '1'
$env:ATOLL_REFERENCE_ICON = 'C:/Programming/atoll/artifacts/icon-floating-island/atoll-floating-island-1024.png'
node scripts/generate-icons.mjs
```

The boards are written to `artifacts/icon-redesign/review-desktop.png` and `artifacts/icon-redesign/review-mobile.png`, alongside their review HTML. They compare the Approved design with the exported artwork on light/dark backgrounds. Desktop application sizes run from 128 to 16 pixels; the narrow board intentionally shows 64 to 16. Both show tray sizes 32, 24 and 16. The independent finish reviewer returned ship with no material fixes; that judgment covers visual appearance, not installer or runtime behavior. The narrow board is a review-layout check, not evidence of a mobile application. Tauri may export mobile icon sets, but this delivery targets Windows.

Validation on 2026-09-10 confirmed an exact decoded-pixel hash match between the distribution master and `artifacts/icon-floating-island/atoll-floating-island-1024.png`, exterior alpha 0 and center alpha 255. The ICO contains 16, 24, 32, 48, 64 and 256-pixel entries. All 52 checked raster assets carried provenance metadata. `pnpm tauri build --bundles nsis` passed, including TypeScript, Vite, Rust release compilation and NSIS packaging. It produced `src-tauri/target/release/atoll.exe` and `src-tauri/target/release/bundle/nsis/Atoll_0.1.0_x64-setup.exe`. The build script explicitly tracks icons/icon.ico so Windows resources refresh when artwork changes. After rebuilding, the icon extracted from a fresh copy of the EXE was visually verified as Floating Island. Installation and runtime behavior were not re-tested as part of the icon review.

The approved composition is the icon authority. Its painted colors remain specific to brand artwork and do not become UI status tokens. The application and tray artwork remain static.
