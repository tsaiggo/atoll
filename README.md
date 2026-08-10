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

Atoll is a Windows status island fixed to the top-center of the primary display. At idle, it contracts into a clickable **Reef**; when media, volume, or an intentional user action needs attention, it expands into controls and then quietly recedes. It borrows the interaction grammar of a compact status surface while using native Windows capabilities, Segoe UI, and Windows Widgets-inspired Acrylic—without reproducing Apple product assets or framing.

Its purpose is simple: surface current media, system volume, and laptop battery-discharge energy in a local status layer that never steals focus or interrupts work.

## Current capabilities

| Area | What it does |
| --- | --- |
| **Status-island shell** | Stays at the top-center of the primary display; does not steal focus or appear in the normal taskbar; supports high DPI, common multi-display layouts, and fullscreen auto-hide by default, which can be disabled in Settings. |
| **Now playing** | Reads cover art, track, artist, playback state, and real timeline data from compatible Windows GSMTC sessions; supports previous, play/pause, next, and seeking when the player explicitly supports it. |
| **Media sources** | Automatically picks a suitable source when several compatible apps publish system media sessions, or lets the user pin one application source for the current run. QQ Music, Spotify, browsers, and other apps work when they publish a GSMTC session. |
| **System volume** | Observes the current default output device's volume and mute state; Home can mute/unmute and adjust system volume directly. |
| **Battery-discharge energy** | Shows today's battery-discharge energy and a separate view for today plus the preceding six calendar days of local history. Values use mWh, Wh, or kWh according to a useful scale. |
| **Local first** | Requires no account and has no ads, telemetry, analytics, or cloud sync. Media and battery data stay on the device. |

> [!NOTE]
> **Battery-discharge energy is not wall-power consumption, total device energy use, or electricity cost.** Atoll estimates energy released while a device is on battery from the capacity/discharge rate reported by Windows; AC-direct power, charging loss, desktops, and UPS devices are outside that measurement. It samples only while Atoll is running—Reef, Hidden, and a tray-resident app still count as running—and does not reconstruct time after the app exits.

## How to use Atoll

| State | Purpose | How it appears |
| --- | --- | --- |
| **Reef** | A compact, persistent entry point | The idle default; click it to expand. |
| **Compact** | One-line media or volume context | Appears only briefly when a concise status is useful. |
| **Expanded** | Home, Media, Sources, Energy history, or Settings | Click Reef; a meaningful track or volume change may also reveal the relevant content. |
| **Hidden** | The native window is fully hidden | Use Hide in Home, or let a foreground fullscreen app hide it when fullscreen auto-hide is enabled. |

- Use `Ctrl + Shift + Space` or left-click the tray icon to toggle between Expanded and the active collapsed state.
- Right-click Atoll or its tray icon for the quick menu, Settings, or Exit.
- Expanded returns to Reef after about four seconds of inactivity. Pointer, wheel, keyboard, and in-panel actions refresh that timeout.
- Select the lower battery card in Home to inspect the most recent seven days. Battery sampling itself never steals the island or opens the history view.
- When two or more application sources are available, the Media view can choose `Automatic` or pin one source. The choice lasts only for the current run.

See [DESIGN.md](DESIGN.md) for the detailed state geometry, material, motion, and accessibility contract.

## Compatibility and scope

- Atoll supports **Windows 11 x64** only and is fixed to the **top-center of the primary display**. It does not offer dragging, manual resizing, display selection, or left/right alignment.
- Media controls use only the metadata and capabilities that a player publishes through Windows GSMTC. If cover art, timeline, seeking, or a transport action is absent, Atoll does not guess or simulate it.
- Seeking also requires a valid media duration of at least one second. Otherwise, the timeline remains read-only.
- Atoll Connect currently uses source-reviewed providers that compile with the app. It does not install runtime plugins, load third-party DLLs, inject processes, or emulate player actions.
- Battery data require a device and Windows driver that report battery capacity. Desktops, battery-less devices, and devices without usable capacity reports show unavailable rather than a fabricated zero.
- First sampling, a previous app exit, sleep/blocking gaps, or temporarily unavailable capacity mark the day as a **partial record**. Atoll never fills in a missing interval.
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

Browser mode has no Windows IPC, so it cannot validate native window behavior, GSMTC, Core Audio, the tray, fullscreen detection, or battery data.

## Development and validation

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite frontend development server |
| `pnpm tauri dev` | Start the full Tauri development app |
| `pnpm build` | Type-check TypeScript and build the frontend to `dist/` |
| `pnpm test` | Run TypeScript/Node logic tests |
| `pnpm preview` | Preview the built frontend |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Check Rust formatting |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked` | Run Rust tests without changing the lockfile |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Treat Rust Clippy warnings as errors |

Run these checks before submitting a change:

```powershell
pnpm build
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

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
| [`src-tauri/`](src-tauri/) | Rust: native windowing, GSMTC media aggregation, Core Audio, fullscreen detection, energy sampling, tray controls, and NSIS configuration. |
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

- No account is required, and no media, volume, or battery data is sent to the network.
- Settings live in local WebView storage.
- Battery-discharge totals and up to 30 completed days of history live at `%LOCALAPPDATA%\com.tsaiggo.atoll\energy-state.json`. Deleting that file resets energy history.
- Diagnostics default to `%LOCALAPPDATA%\com.tsaiggo.atoll\logs\Atoll.log`. Remove track titles, local paths, usernames, and device details that you do not want to share before filing an issue.
- Media data come only from Windows system media sessions that a player actively publishes; Atoll does not read player credentials.

## FAQ

### Why cannot Atoll see my player, or why is a playback button disabled?

First check whether the player appears in the Windows system media panel. Atoll can only use the GSMTC session and capabilities the player publishes; it does not invent missing cover art, seeking, previous, or next controls.

### Why is the battery card unavailable, partial, or showing a very small value?

The card is available only when Windows reports battery capacity. On first launch, after sleep, after a sampling gap of roughly three minutes or more, or while a driver temporarily withholds data, Atoll keeps known data and marks the day as a partial record instead of estimating the gap. Below 10 Wh it shows Wh or mWh, so a short interval is not rounded to the same `0.01 kWh` value.

### Why does Rust fail to find `link.exe` or a Windows SDK?

In Visual Studio Installer, add the `Desktop development with C++` workload to Build Tools 2022 and verify that MSVC plus a Windows 10/11 SDK are selected. Reopen the terminal afterwards.

### Why is the Tauri window blank or why does WebView2 fail to start?

Install or repair the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/), then restart Atoll.

## License

This repository does not yet contain a `LICENSE` file. Publicly visible source code is not permission to copy, modify, or redistribute it; retain all rights until maintainers choose and add an explicit license.

---

<div align="center">
  <strong>Atoll</strong> · Your status, surfaced.
</div>
