---
version: 1
slug: "assets-atoll-icon-svg"
primary_target: "assets/atoll-icon.svg"
related_targets: ["assets/atoll-icon-paint.png", "assets/atoll-icon-paint.prompt.txt", "assets/atoll-icon.png", "assets/atoll-tray.svg", "assets/atoll-tray-16.png", "src-tauri/icons", "src/icons.ts", "scripts/generate-icons.mjs"]
---

Scope: Atoll's Windows application icon, notification-area mark and related in-app glyph. The existing Codenotch shell layout and motion remain unchanged.

Audience and job: A Windows user recognizes Atoll in Explorer, installation surfaces and the notification area. Keep the floating capsule motif readable across application and tray sizes.

Visual authority: The user explicitly approved Floating Island with “可以，就这个”. The approved artwork governs the composition and color; SVG clipping and transparent PNG/ICO export are authorized. Codenotch informs the painterly style.

Name and thesis: Floating Island. A quiet black status capsule floats over tactile painted color. A left cyan status light and three white bars on the right express an ambient desktop utility.

Composition: The fully detached horizontal capsule leaves visible pigment around all four sides. Cyan and lilac rise above cobalt; coral and peach sweep through the lower right. The generated source includes the complete composition. The application SVG has a 1254-unit viewBox and clips the source to a rounded rectangle at (88, 88), size 1076 × 1076, radius 260. This excludes the source's unwanted exterior checkerboard and produces true transparency. No reef, lagoon or edge-attached circular indicator belongs to the approved icon.

Small-size treatment: The 24-unit tray drawing uses a dark capsule at (1, 5), size 22 × 14, radius 7, with a white 1.2-unit outline. Its white status dot is at (6, 12), radius 1.4. Three white round-ended bars use 1.8-unit strokes: x=13 from y=12 to 14, x=16 from 9 to 14, and x=19 from 10.5 to 14. The shell glyph uses the same motif in current color. The app and tray artwork are static.

Ingredient inventory:
- Approved composition: `artifacts/icon-floating-island/atoll-floating-island-1024.png`.
- Complete generated source: `assets/atoll-icon-paint.png`; exact prompt: `assets/atoll-icon-paint.prompt.txt`.
- Authored outer clip: `assets/atoll-icon.svg`; transparent distribution master: `assets/atoll-icon.png`.
- Authored monochrome tray SVG, PNG exports, `src/icons.ts` glyph and Tauri packaging exports.
- Provenance: Codenotch painterly style influence; an earlier generated Atoll concept supplied the image-generation input.

Validation: The 1024-pixel distribution master exactly matches the approved image's decoded pixel hash. Exterior alpha is 0 and center alpha is 255. The ICO contains 16, 24, 32, 48, 64 and 256-pixel entries; a provenance scan found metadata on all 52 checked rasters. The independent finish review returned ship with no material fixes, scoped to appearance rather than runtime or installer behavior. `pnpm tauri build --bundles nsis` passed, including TypeScript, Vite, Rust release compilation and NSIS packaging. It produced `src-tauri/target/release/atoll.exe` and `src-tauri/target/release/bundle/nsis/Atoll_0.1.0_x64-setup.exe`. This confirms the packaging build; installation and runtime behavior were not re-tested as part of the icon review.

Review boards: `artifacts/icon-redesign/review-desktop.png` and `artifacts/icon-redesign/review-mobile.png` compare the Approved design with the packaged artwork on light/dark backgrounds. Desktop application sizes run from 128 to 16 pixels; the narrow board shows 64 to 16. Both include tray sizes 32, 24 and 16. The narrow board is documentation presentation, not a shipped mobile app.

Reproduction and provenance: See `docs/icon-design.md`; the existing Codenotch MIT notice remains in `THIRD_PARTY_NOTICES.md` for the project's reference-derived work.
