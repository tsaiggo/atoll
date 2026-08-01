---
version: 1
slug: "src-main-ts"
primary_target: "src/main.ts"
related_targets: ["src/styles.css"]
---

Scope: Atoll’s Windows top-edge shell, covering Reef, Compact, and Expanded surfaces. Mode: Operate.

Audience and job: a Windows productivity user must read or act on one important status without leaving the current task. The interaction must remain useful at high DPI, avoid focus theft, and recede when idle.

Content and constraints: real media metadata and supported controls, transient volume feedback, basic persistent settings, full-screen hiding, a single-instance tray utility, no fabricated progress or inactive controls, and no account or telemetry.

Chosen direction: Tide-line C from `.impeccable/mocks/atoll-direction-board.png`. Carry forward its quiet edge attachment, concise hierarchy, and sea-glass status line; pair it with one incomplete elliptical Atoll mark. Do not literalize the generated system-toggle dashboard, decorative reef illustrations, taskbar, desktop wallpaper, or example browser content.

Memorable moment: the 76×10 DIP Reef becomes the same matte object as Compact or Expanded, with the shell moving first and content settling immediately after.

Ingredient inventory:
- Shell, typography, controls, meters, and motion: semantic HTML/CSS.
- Atoll and action icons: project-authored inline SVG.
- Media artwork: real Windows session thumbnail, with a code-native branded placeholder.
- Native window shape, shadow boundary, tray, shortcut, and click region: Rust/Tauri/Win32.
- Reference comp only: `.impeccable/mocks/atoll-direction-board.png`; it is not shipped in the UI.

Unresolved: user-customizable hotkey and monitor selection remain future settings; first release uses Ctrl+Shift+Space and the primary display.
