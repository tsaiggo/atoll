# Atoll

<div align="center">
  <img src="assets/atoll-icon.svg" width="96" height="96" alt="Atoll logo">
  <p><strong>Your status, surfaced.</strong><br>重要状态，浮现于顶端。</p>
  <p>
    <img alt="Version 0.1.0" src="https://img.shields.io/badge/version-0.1.0-16786c">
    <img alt="Windows 11" src="https://img.shields.io/badge/platform-Windows%2011-0078d4?logo=windows11&amp;logoColor=white">
    <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-24c8db?logo=tauri&amp;logoColor=white">
    <img alt="Local first" src="https://img.shields.io/badge/privacy-local--first-3c7b73">
  </p>
  <p><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>
</div>

> [!IMPORTANT]
> Atoll is an early-stage, Windows 11-only project. This repository has no published prebuilt installer or code-signed build yet; run it from source or build the NSIS installer below.

Atoll is a Windows status notch that docks at the center of any edge of the primary display’s work area. Its pure-black shell, inward-curving shoulders, colored status rings, and floating detail panels adapt the [Codenotch design](https://github.com/tsaiggo/codenotch) to Windows. It uses Segoe UI and native Windows capabilities; the shell does not use Acrylic. The default top-edge entry contracts into a small **Reef** until you hover or request controls.

Its purpose is simple: surface current media, system volume, and laptop battery-discharge energy in a local status layer that never steals focus or interrupts work. An optional Codex view can also show the signed-in local Codex CLI's aggregate quota windows and reset times after the user explicitly enables it.

## Current capabilities

| Area | What it does |
| --- | --- |
| **Status notch** | Docks to the top, bottom, left, or right edge of the primary display’s work area; respects the taskbar; does not steal focus or appear in the normal taskbar. Supports high DPI, display-layout changes, and fullscreen auto-hide, enabled by default. |
| **Now playing** | Reads cover art, track, artist, playback state, and real timeline data from compatible Windows GSMTC sessions; supports previous, play/pause, next, and seeking when the player explicitly supports it. |
| **Media sources** | Automatically picks a suitable source when several compatible apps publish system media sessions, or lets the user pin one application source for the current run. QQ Music, Spotify, browsers, and other apps work when they publish a GSMTC session. |
| **System volume** | Observes the current default output device’s volume and mute state. Open its status ring for a dedicated volume slider and mute control; Home retains its inline controls. |
| **Battery-discharge energy** | Shows today's battery-discharge energy and a separate view for today plus the preceding six calendar days of local history. Values use mWh, Wh, or kWh according to a useful scale. |
| **Codex usage (optional)** | After an explicit local opt-in, reads aggregate Codex quota windows, reset times, and available token-activity buckets through the installed Codex App Server. It can surface a quiet reminder when a limit crosses a threshold or actually resets. |
| **Local first** | Core media, volume, and battery features require no account and have no ads, telemetry, analytics, or cloud sync. The optional Codex integration uses the user's existing local Codex sign-in only after consent. |

> [!NOTE]
> **Battery-discharge energy is not wall-power consumption, total device energy use, or electricity cost.** Atoll estimates energy released while a device is on battery from the capacity/discharge rate reported by Windows; AC-direct power, charging loss, desktops, and UPS devices are outside that measurement. It samples only while Atoll is running—Reef, Hidden, and a tray-resident app still count as running—and does not reconstruct time after the app exits.

## How to use Atoll

| State | Purpose | How it appears |
| --- | --- | --- |
| **Reef** | A small entry point | Default when idle with **On hover** visibility; hover to reveal the status rail, or click to open controls. |
| **Compact** | Four status rings and the Atoll control | Hover Reef or choose **Always visible** in Settings. Hover a ring to open its detail. |
| **Expanded** | Status rail plus Home, Media, Volume, Sources, Energy history, Codex usage, or Settings | Hover a status, click blank rail space to pin, or open controls through the shortcut or tray. Meaningful media or volume changes may also reveal controls. |
| **Hidden** | The native window is fully hidden | Use Hide in Home, or let a foreground fullscreen app hide it when fullscreen auto-hide is enabled. |

- Use `Ctrl + Shift + Space` or left-click the tray icon to toggle between Expanded and the active collapsed state.
- Right-click Atoll or its tray icon for the quick menu, Settings, or Exit.
- Hover opens the rail and then a status detail. Clicking empty rail space pins or unpins it; the pin control is also available by keyboard. Clicking an enabled Codex ring refreshes its reading. When unpinned, leaving the notch for about 450 ms returns to Reef, or to the rail when **Always visible** is selected.
- Event and shortcut openings retain a four-second inactivity timeout when the pointer is outside and no panel is pinned. Keyboard interaction keeps the active controls available. `Escape` collapses controls; Sources first returns to Media, while Energy or Codex first returns to Home.
- In Settings, choose **Top**, **Bottom**, **Left**, or **Right**, and **On hover** or **Always visible**. Both preferences persist locally.
- Select the lower battery card in Home to inspect the most recent seven days. Battery sampling itself never steals the island or opens the history view.
- When two or more application sources are available, the Media view can choose `Automatic` or pin one source. The choice lasts only for the current run.
- Hover the **Codex** ring or choose **Codex usage** from the tray or right-click menu to open its panel. It is disabled by default; the first Enable action is the consent boundary. Routine polling never opens the notch, while a limit crossing or genuine reset may briefly surface it.

See [DESIGN.md](DESIGN.md) for the detailed state geometry, material, motion, and accessibility contract.

## Compatibility and scope

- Atoll supports **Windows 11 x64**. Placement uses the center of the selected edge of the **primary display’s work area**, including taskbar space and layout changes. It does not offer dragging, manual resizing, or display selection.
- Media controls use only the metadata and capabilities that a player publishes through Windows GSMTC. If cover art, timeline, seeking, or a transport action is absent, Atoll does not guess or simulate it.
- Seeking also requires a valid media duration of at least one second. Otherwise, the timeline remains read-only.
- Atoll Connect currently uses source-reviewed providers that compile with the app. It does not install runtime plugins, load third-party DLLs, inject processes, or emulate player actions.
- Battery data require a device and Windows driver that report battery capacity. Desktops, battery-less devices, and devices without usable capacity reports show unavailable rather than a fabricated zero.
- First sampling, a previous app exit, sleep/blocking gaps, or temporarily unavailable capacity mark the day as a **partial record**. Atoll never fills in a missing interval.
- Codex usage is optional and requires an installed, ChatGPT-authenticated Codex CLI with App Server support. API-key-only and Bedrock sessions may not expose usage activity; Atoll shows an honest unavailable state rather than inventing a quota or reset time. App Server compatibility can change because the CLI interface is still evolving.
- There is no in-app updater, automated release workflow, or Authenticode code signing yet.

## Run from source

### Prerequisites

| Dependency | Requirement |
| --- | --- |
| Operating system | Windows 11 x64 |
| C++ toolchain | Visual Studio Build Tools 2022 with the `Desktop development with C++` workload, including MSVC, a Windows SDK, and `link.exe` |
| WebView | Current [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/); it is normally included with Windows 11 |
| Node.js | `20.19+` or `22.12+` |
| pnpm | A version that reads this repository's lockfile; pnpm 11 is recommended |
| Rust | Stable MSVC toolchain (`x86_64-pc-windows-msvc`) |
| Codex usage (optional) | A locally installed Codex CLI signed in with a supported ChatGPT/Codex account; Atoll does not bundle Codex. |

One way to install pnpm and select the Rust toolchain:

```powershell
npm install --global pnpm@latest-11
rustup default stable-msvc
```

Then run the complete desktop app:

```powershell
git clone https://github.com/tsaiggo/atoll.git
cd atoll
pnpm install --frozen-lockfile
pnpm tauri dev
```

`pnpm tauri dev` starts Vite and the native Tauri host together. It is the right way to validate the top-level window, media sessions, volume, tray, fullscreen policy, and battery sampling.

For frontend layout work only:

```powershell
pnpm dev
```

Browser mode has no Windows IPC, so it cannot validate native window behavior, GSMTC, Core Audio, the tray, fullscreen detection, or battery data. Layout fixtures are available at `http://localhost:1420/?preview=expanded-media&edge=top`; use `reef`, `compact-media`, `expanded-home`, `expanded-media`, `expanded-volume`, `expanded-energy`, `expanded-codex`, `expanded-sources`, or `settings`, with `top`, `bottom`, `left`, or `right`. These previews use synthetic data and do not enable the native Codex integration.

## Development and validation

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite frontend development server |
| `pnpm tauri dev` | Start the full Tauri development app |
| `pnpm build` | Type-check TypeScript and build the frontend to `dist/` |
| `pnpm test` | Run TypeScript/Node logic tests, including notch geometry, settings migration, and panel controls |
| `node scripts/verify-notch.mjs` | Check browser interactions, overflow, edge layouts, and capture screenshots against the running Vite server |
| `node scripts/verify-notch-motion.mjs` | Sample live spring frames, constant ring size, stagger, tooltip travel and dismissal on all four edges |
| `pnpm preview` | Preview the built frontend |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Check Rust formatting |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked` | Run Rust tests without changing the lockfile |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Treat Rust Clippy warnings as errors |

The browser verification script uses an existing Playwright installation. Make `playwright` resolvable or set `ATOLL_PLAYWRIGHT_MODULE` to its module path; no Playwright dependency is added to the app. The scripts default to port 1425; `ATOLL_PREVIEW_URL` overrides the Vite URL. Start that server with `pnpm dev -- --port 1425`. Native behavior still requires Windows verification.

Run these checks before submitting a change:

```powershell
pnpm build
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## Codenotch fidelity

The implementation ports the source measurements at 44/117 scale, its corner-first circular contour, upright ring layout, tooltip width, palette thresholds and spring parameters. Shapes unfold over fixed-size content inside a transparent host; the same frame supplies the Windows hit region. Settings and media/volume/energy controls are Atoll extensions.

Windows uses Segoe UI and WebView2 instead of SF Pro and SwiftUI. SVG paints true arcs; the native region uses 12 samples per quarter arc plus a two-physical-pixel antialias margin. The source implementation’s triangular tooltip tail is retained even though the design PNG shows a curved join. This is a faithful design port, not a claim of identical platform pixels. See [fidelity evidence](docs/codenotch-fidelity.md) and [upstream notices](THIRD_PARTY_NOTICES.md).

For a directly runnable optimized executable, use `pnpm tauri build --no-bundle` and open `src-tauri/target/release/atoll.exe`. Windows builds use the GUI subsystem, including debug builds, so desktop launches do not allocate a console window.

## Build a Windows installer

Exit any running Atoll instance from its tray menu, then run:

```powershell
pnpm install --frozen-lockfile
pnpm tauri build --bundles nsis --ci
```

This builds the production frontend, compiles the Rust release binary, embeds resources, and packages NSIS. `pnpm build` alone does not create an installer.

Typical output paths for the current x64 release are:

```text
src-tauri/target/release/atoll.exe
src-tauri/target/release/bundle/nsis/Atoll_0.1.0_x64-setup.exe
```

NSIS uses current-user installation and normally does not request administrator privileges. If WebView2 is missing, setup may need to download it. The installer is not Authenticode-signed yet, so Windows SmartScreen may show an unknown-publisher warning. Running a newer installer is useful for an overwrite-install test, but it is not in-app automatic updating.

## Project structure

Atoll has a WebView frontend and a native Windows host that collaborate through Tauri IPC rather than sharing one directory.

| Location | Responsibility |
| --- | --- |
| [`src/`](src/) | TypeScript: app state, domain rules, templates, CSS, Tauri frontend integration, and status-island geometry. |
| [`src-tauri/`](src-tauri/) | Rust: native windowing, GSMTC media aggregation, Core Audio, fullscreen detection, energy sampling, optional local Codex App Server bridge, tray controls, and NSIS configuration. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Module boundaries, dependency direction, and IPC contracts. |
| [`DESIGN.md`](DESIGN.md) | The visual system, geometry, material, state, and motion contract. |

All frontend Tauri `invoke` / `listen` calls live in `src/platform/native.ts`; `src-tauri/src/lib.rs` composes the native side. Read [ARCHITECTURE.md](ARCHITECTURE.md) before adding UI, a system capability, or an Atoll Connect provider.

## Contributing

Bug reports, player-compatibility verification, documentation fixes, and focused product improvements are welcome.

1. Search [Issues](https://github.com/tsaiggo/atoll/issues), then create a clearly named branch from the latest `main`.
2. Read [DESIGN.md](DESIGN.md) for UI work and [ARCHITECTURE.md](ARCHITECTURE.md) for architecture, IPC, or Windows API work.
3. Keep one pull request focused on one clear problem. Do not mix generated artifacts, unrelated refactors, or private media data.
4. Add tests for pure logic and complete a real Windows smoke test for native behavior.
5. Run the checks above and state the commands, Windows version, display scale, and relevant player version in the pull request.
6. When a pull request changes user-visible behavior, compatibility, install paths, limitations, or privacy promises, update both `README.md` and `README.zh-CN.md` in the same pull request. Commands, paths, filenames, and API identifiers must stay identical.

For UI changes, include screenshots on light and dark Windows desktops. For window-geometry changes, state the DPI and multi-display layouts you tested.

### Contributing an Atoll Connect provider

Providers deliberately use a source-contribution model: implementations compile with Atoll and maintainers review them through pull requests. The built-in provider already covers players that publish Windows GSMTC sessions, so QQ Music, Spotify, or browser-specific copies are not needed.

Add a provider only when a source does not publish GSMTC or it can truly add data that the system interface lacks. New implementations belong in `src-tauri/src/connect/providers/`, use stable provider/target IDs, publish structured state, and handle strongly typed media actions. A provider must not manipulate Tauri or frontend UI directly; Connect Hub remains responsible for selection, published state, and command routing.

## Local data and privacy

- Core media, volume, and battery features require no account, and their data is not sent to the network.
- Settings live in local WebView storage.
- Battery-discharge totals and up to 30 completed days of history live at `%LOCALAPPDATA%\com.tsaiggo.atoll\energy-state.json`. Deleting that file resets energy history.
- Codex usage is disabled by default. When you enable it, Atoll starts the locally installed `codex app-server` over private stdio and requests only aggregate quota windows, reset times, and token-activity buckets from the current Codex sign-in. It does not read prompts, files, account IDs, API keys, cookies, or credential files; it does not call login, logout, or consume a reset credit.
- Diagnostics default to `%LOCALAPPDATA%\com.tsaiggo.atoll\logs\Atoll.log`. Remove track titles, local paths, usernames, and device details that you do not want to share before filing an issue.
- Media data come only from Windows system media sessions that a player actively publishes; Atoll does not read player credentials.

## FAQ

### Why cannot Atoll see my player, or why is a playback button disabled?

First check whether the player appears in the Windows system media panel. Atoll can only use the GSMTC session and capabilities the player publishes; it does not invent missing cover art, seeking, previous, or next controls.

### Why is the battery card unavailable, partial, or showing a very small value?

The card is available only when Windows reports battery capacity. On first launch, after sleep, after a sampling gap of roughly three minutes or more, or while a driver temporarily withholds data, Atoll keeps known data and marks the day as a partial record instead of estimating the gap. Below 10 Wh it shows Wh or mWh, so a short interval is not rounded to the same `0.01 kWh` value.

### Why is Codex usage unavailable or not showing a reset time?

Codex usage is opt-in and works only through a locally installed Codex CLI with a supported signed-in Codex/ChatGPT session. Open **Codex usage** from the tray menu, enable it, then ensure `codex app-server` is available. API-key-only and Bedrock sessions do not provide the same account usage activity. Atoll never scrapes the Codex UI or guesses missing limits; it shows unavailable when the official local App Server has no usable window. See the [official Codex App Server documentation](https://developers.openai.com/codex/app-server/).

### Why does Rust fail to find `link.exe` or a Windows SDK?

In Visual Studio Installer, add the `Desktop development with C++` workload to Build Tools 2022 and verify that MSVC plus a Windows 10/11 SDK are selected. Reopen the terminal afterwards.

### Why is the Tauri window blank or why does WebView2 fail to start?

Install or repair the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/), then restart Atoll.

## License

This repository does not yet contain a `LICENSE` file for Atoll itself. Public visibility alone does not grant permission to copy, modify, or redistribute unrelated Atoll code. The MIT notice for the Codenotch design reference is retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

<div align="center">
  <strong>Atoll</strong> · Your status, surfaced.
</div>
