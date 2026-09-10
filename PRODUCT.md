# Product

<!-- impeccable:product-schema 1 -->

## Platform

Windows 11 desktop application, built with Tauri 2 and a WebView2 HTML/CSS/TypeScript renderer. Browser previews are development surfaces, not the product's operating platform.

## Users

Atoll serves people who spend long sessions working on Windows and want to check or act on media and system status without leaving the current task. This includes media listeners, productivity users, multi-monitor and high-DPI users, and people who prefer quieter notifications.

## Product Purpose

Atoll is an ambient desktop status layer attached to a chosen work-area edge. It exposes useful current readings and common controls, then recedes when the user no longer needs them.

Success means a reliable resident utility: quick launch, quiet idle behavior, no focus theft or unrelated click interception, resilience to display and media changes, and a complete local control loop.

## Positioning

Atoll is a Windows edge notch. The user-selected Codenotch reference supplies its silhouette, ring presentation and hover interaction. Atoll retains its own brand, Windows host and integrated media, battery-discharge and optional Codex capabilities.

The Reef is its minimal dormant state. It unfolds into a status rail and a focused detail bubble, with pinning when a reading or management task should remain available.

## Operating Context

- Windows 11 desktop sessions, including high-DPI, multiple displays, negative-coordinate layouts, portrait and ultrawide screens.
- The selected work-area edge may be top, bottom, left or right; top is the default. Work-area anchoring accounts for reserved taskbar space.
- A fixed transparent native host holds the animated silhouette. Only exact regions and narrow pointer corridors should intercept input; the unused host rectangle should not.
- Users may continue typing, watching fullscreen media, gaming or listening while Atoll remains resident.
- The default global shortcut is `Ctrl + Shift + Space`; tray and context-menu actions provide recovery and complete exit.
- Native no-activation behavior is a product requirement and must be verified as part of host changes.

## Capabilities and Constraints

- Four shell states: Hidden, Reef, Compact and Expanded, with three directly reachable status modules.
- Persistent top/bottom/left/right placement, automatic or always-visible behavior, Chinese/English language and fullscreen hiding.
- Blank-rail pinning, ring-hover inspection and pinned settings/management work.
- Single instance; a second launch summons the existing instance. No ordinary taskbar entry.
- Atoll Connect enumerates Windows media sessions, selects a relevant source and exposes only the metadata, timeline, artwork and GSMTC controls that players publish.
- Unsupported media controls or progress are not fabricated.
- Battery-discharge energy recorded locally with a 30-calendar-day view including today, four summary rows (today, recorded period total, peak recorded day and coverage), selectable daily bars, missing-day gaps and explicit partial records. Values use Wh below 1000 Wh and kWh/度 at or above it, with mWh retained for positive readings below 10 mWh. This is neither whole-PC wall-power measurement nor a battery-charge percentage.
- Codex usage is optional and disabled by default. A direct Enable action starts the local App Server integration. The surface shows aggregated actual usage windows and reset times, supports refresh and turn-off, and fails softly when local authentication or CLI support is unavailable.
- No Codex prompts, files, account identifiers, API keys, raw protocol payloads or reset-credit actions are exposed by the UI.
- Core behavior is local and does not require an Atoll account, cloud sync, ads, telemetry, analytics or unrelated content capture. Optional integrations use their existing local service/account boundary.
- No administrator permission, process injection or broad notification scraping is part of the product.
- Integrations must fail softly and use bounded local diagnostics. The first release avoids text-entry workflows.

## Brand Commitments

- Product name: Atoll. English line: “Your status, surfaced.”
- The established Chinese line is “重要状态，浮现于顶端。” It is retained brand copy, not a top-only placement constraint.
- Floating Island is the user-approved application icon: a detached horizontal black capsule on a painterly cyan, cobalt, lilac, coral and peach canvas, with a cyan status light on the left and three white bars on the right. The approved artwork and authored monochrome capsule variants are the brand authority.
- Voice is concise, calm and useful.
- The live shell follows the user-approved Codenotch black-and-white material, reference geometry and measured Codex color bands. The multicolored packaged icon is an identity asset; its pigment palette does not change the shell's measured status colors or Windows operating platform.

## Evidence on Hand

- Original product requirements remain at `C:\Users\ttsai\.codex\attachments\19d829d9-eed1-4fcd-b5c5-557e8ef3cecd\pasted-text.txt`.
- The user supplied `https://github.com/tsaiggo/codenotch` as the reproduction reference. Its MIT notice is retained in `THIRD_PARTY_NOTICES.md`.
- Brand sources are the complete generated composition at `assets/atoll-icon-paint.png`, its exact prompt at `assets/atoll-icon-paint.prompt.txt`, the authored outer clip at `assets/atoll-icon.svg`, and the monochrome `assets/atoll-tray.svg`. The transparent distribution master is `assets/atoll-icon.png`; reproduction and provenance are recorded in `docs/icon-design.md`.
- Demo readings are synthetic and labeled in development previews. Customer claims, benchmarks and unrelated media assets must not be invented.

## Product Principles

1. Surface useful information, then recede.
2. Preserve the user's task, focus and unrelated desktop input.
3. Express state changes through continuous, reference-grounded motion.
4. Prefer reliable local behavior over feature count.
5. Treat honest measurement, privacy, idle efficiency and graceful failure as product features.

## Accessibility & Inclusion

- Respect Windows reduced motion and avoid unnecessary idle animation or continuous repainting.
- Preserve reading and input behavior across 125%, 150% and 200% display scaling.
- Provide keyboard shortcut, keyboard control, context menu and tray access alongside hover.
- Use glyphs, numeric readings, text and semantic states in addition to color.
- Keep pending controls protected from collapse; preserve focused inputs and same-panel scroll positions during updates.
