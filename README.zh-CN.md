# Atoll

<div align="center">
  <img src="assets/atoll-icon.svg" width="96" height="96" alt="Atoll 标志">
  <p><strong>重要状态，浮现于顶端。</strong><br>Your status, surfaced.</p>
  <p>
    <img alt="版本 0.1.0" src="https://img.shields.io/badge/version-0.1.0-16786c">
    <img alt="Windows 11" src="https://img.shields.io/badge/platform-Windows%2011-0078d4?logo=windows11&amp;logoColor=white">
    <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-24c8db?logo=tauri&amp;logoColor=white">
    <img alt="本地优先" src="https://img.shields.io/badge/privacy-local--first-3c7b73">
  </p>
  <p><strong>简体中文</strong> · <a href="README.md">English</a></p>
</div>

> [!IMPORTANT]
> Atoll 仍处于早期开发阶段，仅支持 Windows 11。仓库当前没有已发布的预编译安装包或代码签名版本；请按下文从源码运行或自行构建 NSIS 安装包。

Atoll 是一个固定在主显示器顶部中央的 Windows 状态岛。它平时收为可点击的 **Reef**，在媒体、音量或用户操作需要时展开成控制面板，空闲后安静收回。它借鉴紧凑状态表面的交互语法，但使用 Windows 原生能力、Segoe UI 与 Widgets 风格的 Acrylic 材质，而不是复刻任何 Apple 产品或资产。

它的目标很简单：把当前媒体、系统音量和笔记本电池放电放到一条不抢焦点、不中断工作的本地状态层里。

## 当前能力

| 模块 | 可以做什么 |
| --- | --- |
| **状态岛外壳** | 固定于主显示器顶部中央；不抢焦点、不出现在普通任务栏；支持高 DPI、常见多显示器布局；默认在前台全屏应用时自动隐藏，也可在设置中关闭。 |
| **当前媒体** | 通过 Windows GSMTC 读取兼容播放器的封面、曲目、艺术家、播放状态和真实进度；支持上一首、播放/暂停、下一首，以及播放器明确支持时的进度定位。 |
| **媒体来源** | 在多个兼容应用同时发布系统媒体会话时，自动选择合适来源，或在面板内临时固定到一个应用来源。QQ 音乐、Spotify 和浏览器等只要发布 GSMTC 会话即可接入。 |
| **系统音量** | 监听当前默认输出设备的音量和静音状态；可在 Home 中静音/恢复、直接调节主音量。 |
| **电池放电** | 显示今日电池放电，并在独立面板查看今天加前六个日历日的本地记录。当前值会使用 mWh、Wh 或度（kWh）等适合量级的单位显示。 |
| **本地优先** | 不要求账号、没有广告、遥测、分析或云同步；媒体信息和电池记录只在本机使用。 |

> [!NOTE]
> **“电池放电”不是插座耗电、整机总耗电或电费。** Atoll 只根据 Windows 报告的电池容量/放电速率估算设备在电池供电期间释放的能量；插电直供、充电损耗、台式机和 UPS 都不在统计范围内。它只在 Atoll 运行期间采样（收为 Reef、Hidden 或驻留托盘时仍在运行）；退出应用后的时间不会补算。

## 如何使用

| 状态 | 作用 | 进入方式 |
| --- | --- | --- |
| **Reef** | 轻量、常驻的入口 | 空闲时默认状态；点击即可展开。 |
| **Compact** | 一行简短的媒体或音量上下文 | 仅在需要简短反馈时短暂出现。 |
| **Expanded** | Home、媒体、来源、耗电历史或设置 | 点击 Reef；有意义的切歌或音量变化也可能打开相关内容。 |
| **Hidden** | 完全隐藏原生窗口 | 使用 Home 的 Hide，或在启用“全屏自动隐藏”时由前台全屏应用触发。 |

- 使用 `Ctrl + Shift + Space` 或左键单击托盘图标，在 Expanded 与当前可见的收起状态之间切换。
- 右键 Atoll 或托盘图标可打开快捷菜单、进入设置或退出。
- Expanded 默认约 4 秒无交互后回到 Reef；鼠标、滚轮、键盘和面板操作都会刷新等待时间。
- 在 Home 中点击下方的电池卡可查看近 7 天。电池采样本身**不会**抢占岛体或自动打开历史页。
- 当有两个及以上应用来源时，进入媒体页后可选择“自动”或临时固定一个来源；选择只在本次运行中保留。

详细的状态尺寸、材质、动效和可访问性规则见 [DESIGN.md](DESIGN.md)。

## 兼容性与边界

- 仅支持 **Windows 11 x64**，且岛体固定在**主显示器顶部中央**；不提供拖动、缩放、指定显示器或左右对齐。
- 媒体控制只使用播放器实际发布给 Windows 的 GSMTC 元数据与能力。播放器没有发布封面、时间线、定位或某个传输控制时，Atoll 不会猜测或模拟。
- 进度定位还需要一个有效且至少 1 秒的媒体时长；未满足时进度仅供阅读。
- Atoll Connect 当前采用随应用一起编译、通过 PR 审核的源码 Provider，不支持运行时安装插件、加载第三方 DLL、进程注入或模拟播放器操作。
- 电池信息依赖设备和 Windows 驱动报告容量。台式机、没有电池的设备或不报告容量的设备会显示不可用，而不是伪造为零。
- 首次采样、此前退出应用、睡眠/阻塞导致的长间隔，或容量暂时不可用，都会让当天记录标为“部分记录”；Atoll 不会补算缺失时间。
- 当前没有应用内更新器、自动发布工作流或 Authenticode 代码签名。

## 从源码运行

### 环境要求

| 依赖 | 要求 |
| --- | --- |
| 操作系统 | Windows 11 x64 |
| C++ 工具链 | Visual Studio Build Tools 2022，安装“使用 C++ 的桌面开发”工作负载（含 MSVC、Windows SDK 与 `link.exe`） |
| WebView | 当前 [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)；Windows 11 通常已内置 |
| Node.js | `20.19+` 或 `22.12+` |
| pnpm | 可读取本仓库 lockfile 的版本，推荐 pnpm 11 |
| Rust | stable MSVC 工具链（`x86_64-pc-windows-msvc`） |

安装 pnpm 与确认 Rust 工具链的一种方式：

```powershell
npm install --global pnpm@latest-11
rustup default stable-msvc
```

然后运行完整桌面应用：

```powershell
git clone https://github.com/tsaiggo/atoll.git
cd atoll
pnpm install --frozen-lockfile
pnpm tauri dev
```

`pnpm tauri dev` 会同时启动 Vite 与 Tauri 原生宿主，是验证顶部窗口、媒体会话、音量、托盘、全屏策略和电池采样的方式。

只调试前端布局时可运行：

```powershell
pnpm dev
```

浏览器模式没有 Windows IPC，因此不能用来验收原生窗口、GSMTC、Core Audio、托盘、全屏检测或电池数据。

## 开发与验证

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Vite 前端开发服务器 |
| `pnpm tauri dev` | 启动完整 Tauri 开发应用 |
| `pnpm build` | TypeScript 类型检查并构建前端到 `dist/` |
| `pnpm test` | 运行 TypeScript/Node 逻辑测试 |
| `pnpm preview` | 预览已构建的前端产物 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 检查 Rust 格式 |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked` | 运行 Rust 测试且不修改锁文件 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | 将 Rust Clippy 警告视为错误 |

提交前的完整本地检查：

```powershell
pnpm build
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## 构建 Windows 安装包

先从 Atoll 托盘菜单退出可能正在运行的实例，再执行：

```powershell
pnpm install --frozen-lockfile
pnpm tauri build --bundles nsis --ci
```

这条命令会完成前端生产构建、Rust release 编译、资源嵌入和 NSIS 打包。`pnpm build` 本身不会生成安装包。

当前版本在 x64 Windows 上的常见产物位置为：

```text
src-tauri/target/release/atoll.exe
src-tauri/target/release/bundle/nsis/Atoll_0.1.0_x64-setup.exe
```

NSIS 使用当前用户安装模式，通常不请求管理员权限；若目标机器缺少 WebView2，安装过程可能需要联网下载 Runtime。安装包目前未进行 Authenticode 签名，因此 Windows SmartScreen 可能显示“未知发布者”。重复运行更新版本的安装器可以用于覆盖安装测试，但这不等同于应用内自动更新。

## 工程结构

Atoll 有一个 WebView 前端和一个 Windows 原生宿主；两者通过 Tauri IPC 协作，而不是混在同一个目录。

| 位置 | 职责 |
| --- | --- |
| [`src/`](src/) | TypeScript：应用状态、领域规则、模板、CSS、Tauri 前端封装和状态岛几何。 |
| [`src-tauri/`](src-tauri/) | Rust：原生窗口、GSMTC 媒体聚合、Core Audio、全屏检测、能源采样、托盘和 NSIS 配置。 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 模块边界、依赖方向与 IPC 契约。 |
| [`DESIGN.md`](DESIGN.md) | 视觉系统、尺寸、材质、状态和动效契约。 |

前端的所有 Tauri `invoke` / `listen` 都收敛在 `src/platform/native.ts`；原生端则由 `src-tauri/src/lib.rs` 装配。新增 UI、系统能力或 Connect Provider 前，请先阅读 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 贡献

欢迎 Bug 报告、播放器兼容性验证、文档修复和聚焦的功能改进。

1. 先搜索 [Issues](https://github.com/tsaiggo/atoll/issues)，再从最新 `main` 建立描述清晰的分支。
2. 涉及 UI 时阅读 [DESIGN.md](DESIGN.md)；涉及架构、IPC 或 Windows API 时阅读 [ARCHITECTURE.md](ARCHITECTURE.md)。
3. 保持一个 PR 只解决一个清晰问题；不要混入生成物、无关重构或私人媒体数据。
4. 为纯逻辑补测试；Windows 原生行为请完成实机 smoke test。
5. 运行上节检查，并在 PR 中写明测试命令、Windows 版本、缩放比例和相关播放器版本。
6. 若 PR 改变用户可见行为、兼容性、安装路径、限制或隐私承诺，请在同一 PR 同步更新 `README.md` 与 `README.zh-CN.md`；命令、路径、文件名和 API 标识保持逐字一致。

UI 变更请附浅色/深色 Windows 桌面截图；修改窗口几何时，请注明测试过的 DPI 与多显示器布局。

### 贡献 Atoll Connect Provider

Provider 目前采用刻意精简的源码贡献模式：实现随 Atoll 一起编译，由维护者通过 Pull Request 审核。兼容 Windows GSMTC 的播放器已经由内置 Provider 覆盖，不需要为 QQ 音乐、Spotify 或浏览器各复制一套实现。

只有某个来源不发布 GSMTC，或确实能补充系统接口没有的数据时，才适合新增 Provider。新实现应位于 `src-tauri/src/connect/providers/`，保持稳定的 Provider/目标 ID，发布结构化状态并处理强类型媒体 action。Provider 不直接操作 Tauri 或前端 UI；来源选择、公开状态和命令路由仍由 Connect Hub 统一处理。

## 本地数据与隐私

- 不需要账号；不发送媒体、音量或电池信息到网络。
- 设置保存在本机 WebView 的 local storage 中。
- 电池放电累计和最多 30 个已完成日的历史保存在 `%LOCALAPPDATA%\com.tsaiggo.atoll\energy-state.json`。删除该文件会清空耗电历史。
- 诊断日志默认位于 `%LOCALAPPDATA%\com.tsaiggo.atoll\logs\Atoll.log`。提交 Issue 前请删除不希望公开的歌曲标题、本地路径、用户名或设备信息。
- 媒体数据只来自播放器主动公开给 Windows 的系统媒体会话；Atoll 不读取播放器账号或密码。

## 常见问题

### 为什么看不到播放器，或某些播放按钮不可用？

先确认播放器是否出现在 Windows 系统媒体面板。Atoll 只能读取它实际公开的 GSMTC 会话与能力；缺少封面、定位、上一首或下一首能力时，Atoll 不会自行补全。

### 为什么电池卡显示不可用、部分记录或很小的数值？

电池卡只在 Windows 能报告电池容量时可用。首次启动、睡眠、超过约 3 分钟的采样间隔，或驱动暂时不提供数据时，Atoll 会保留已知数据并标为“部分记录”，而不是估算空白时段。小于 10 Wh 时会显示 Wh 或 mWh，因此短时间内的变化不会被固定四舍五入成同一个 `0.01 度`。

### Rust 构建找不到 `link.exe` 或 Windows SDK？

在 Visual Studio Installer 中为 Build Tools 2022 安装“使用 C++ 的桌面开发”工作负载，并确认包含 MSVC 与 Windows 10/11 SDK。安装完成后重新打开终端。

### Tauri 窗口空白或 WebView2 无法启动？

安装或修复 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)，然后重新启动 Atoll。

## License

仓库当前尚未包含 `LICENSE` 文件。代码公开可见不等于已授权复制、修改或再分发；在维护者选择并添加明确许可证前，请保留全部版权。

---

<div align="center">
  <strong>Atoll</strong> · Your status, surfaced.
</div>
