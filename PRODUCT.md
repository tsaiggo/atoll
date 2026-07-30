# Product

<!-- impeccable:product-schema 1 -->

## Platform

Windows desktop

## Users

Atoll is for people who spend long sessions working on Windows and want to check or act on media, timers, and system feedback without leaving the current task. It especially serves productivity users, media listeners, multi-monitor and high-DPI users, and people who prefer quieter notifications.

## Product Purpose

Atoll is a Windows 11 top-of-screen ambient status layer. It surfaces the single most important current status in a compact, non-disruptive form, offers a short path to common controls, and then recedes when the information is no longer useful.

Success means the app is useful as a persistent utility: it launches quickly, remains quiet at idle, does not steal focus or block unrelated clicks, survives display and media changes, and provides a complete local-only loop for status, media control, and timing.

## Positioning

Atoll is not a phone-style “dynamic island” replica. Its distinct mechanism is the Reef: a minimal dormant form that grows into Compact and Expanded states only when desktop context warrants it, preserving screen space and focus.

## Operating Context

- Windows 11 desktop sessions, including high-DPI, multi-monitor, negative-coordinate, portrait, ultrawide, and remote-desktop layouts.
- The primary display’s physical top edge is the first-release anchor.
- Users may be typing, watching full-screen media, gaming, listening to media, or running a focus timer while Atoll remains resident.
- The default global shortcut is `Ctrl + Shift + Space`.
- Tray and context menus are always-available recovery and control surfaces.

## Capabilities and Constraints

- Four shell states: Hidden, Reef, Compact, and Expanded.
- Priority-driven content shared by Demo, media, timer, and volume modules.
- Single instance; a second launch summons the existing instance.
- Tray controls, right-click menu, global shortcut, no ordinary taskbar entry, and complete exit cleanup.
- Atoll Connect enumerates Windows media sessions, selects the most relevant active source, and exposes only metadata, timeline, and controls that the player publishes through GSMTC.
- Full-screen hiding, persistent settings, elapsed-time-correct timers, and event-driven volume feedback.
- Core behavior runs locally with no account, cloud sync, ads, telemetry, analytics, or unrelated content capture.
- No administrator permission, process injection, broad notification scraping, or suspicious hooks.
- Non-core integrations must fail softly and write bounded local diagnostics rather than terminate the app.
- The first release avoids text input and does not fabricate unsupported controls or media progress.

## Brand Commitments

- Product name: Atoll.
- Chinese line: “重要状态，浮现于顶端。”
- English line: “Your status, surfaced.”
- The brand metaphor is a small, stable atoll that carries activity and recedes to a reef.
- Voice is concise, calm, useful, and never attention-seeking.
- The supplied dark Windows-native direction and reef/coral identity are binding; Atoll must not look like a generic system-control collage or a direct Apple pill copy.

## Evidence on Hand

- The complete product requirements are preserved in the original Codex attachment at `C:\Users\ttsai\.codex\attachments\19d829d9-eed1-4fcd-b5c5-557e8ef3cecd\pasted-text.txt`.
- No existing customer claims, benchmarks, media assets, or brand artwork are present and none should be fabricated.
- Demo content is explicitly synthetic and exists only to exercise the real state pipeline.

## Product Principles

1. Surface useful information, then recede.
2. Never steal the user’s task or screen space.
3. Express state changes through restrained, continuous motion.
4. Prefer reliable local behavior over feature count.
5. Treat privacy, idle efficiency, and graceful failure as product features.

## Accessibility & Inclusion

- Respect Windows reduced-motion preferences and avoid unnecessary animation or continuous repainting.
- Preserve legibility and hit targets across 125%, 150%, and 200% display scaling.
- Support mouse, keyboard shortcut, and tray access without requiring precise hover gestures.
- Do not communicate warning, completion, mute, or playback state by color alone.
