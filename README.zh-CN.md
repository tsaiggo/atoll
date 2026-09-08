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

Atoll 是一个可停靠在主显示器工作区四边中央的 Windows 状态刘海。纯黑外壳、内凹肩角、彩色状态环和浮动详情面板改编自 [Codenotch 设计](https://github.com/tsaiggo/codenotch)，并结合 Segoe UI 与 Windows 原生能力；外壳不使用 Acrylic。默认从顶部的小型 **Reef** 入口开始，悬停或主动操作时展开控制。

它的目标很简单：把当前媒体、系统音量和笔记本电池放电放到一条不抢焦点、不中断工作的本地状态层里。用户明确启用后，还可通过独立 Codex 面板查看本机已登录 Codex CLI 的聚合配额窗口与重置时间。

## 当前能力

| 模块 | 可以做什么 |
| --- | --- |
| **状态刘海** | 可停靠主显示器工作区的顶部、底部、左侧或右侧，并避让任务栏；不抢焦点、不出现在普通任务栏；支持高 DPI、显示器布局变化与默认开启的全屏自动隐藏。 |
| **当前媒体** | 通过 Windows GSMTC 读取兼容播放器的封面、曲目、艺术家、播放状态和真实进度；支持上一首、播放/暂停、下一首，以及播放器明确支持时的进度定位。 |
| **媒体来源** | 在多个兼容应用同时发布系统媒体会话时，自动选择合适来源，或在面板内临时固定到一个应用来源。QQ 音乐、Spotify 和浏览器等只要发布 GSMTC 会话即可接入。 |
| **系统音量** | 监听当前默认输出设备的音量和静音状态；打开音量状态环即可使用独立滑杆与静音控制，Home 也保留行内音量控制。 |
| **电池放电** | 显示今日电池放电，并在独立面板查看今天加前六个日历日的本地记录。当前值会使用 mWh、Wh 或度（kWh）等适合量级的单位显示。 |
| **Codex 用量（可选）** | 用户明确授权后，通过已安装的 Codex App Server 读取聚合配额窗口、重置时间和可用的 token 活动统计；额度跨阈值或真正重置时可安静提示。 |
| **本地优先** | 核心媒体、音量和电池功能不要求账号，也没有广告、遥测、分析或云同步；可选 Codex 集成只会在用户同意后使用既有的本机 Codex 登录。 |

> [!NOTE]
> **“电池放电”不是插座耗电、整机总耗电或电费。** Atoll 只根据 Windows 报告的电池容量/放电速率估算设备在电池供电期间释放的能量；插电直供、充电损耗、台式机和 UPS 都不在统计范围内。它只在 Atoll 运行期间采样（收为 Reef、Hidden 或驻留托盘时仍在运行）；退出应用后的时间不会补算。

## 如何使用

| 状态 | 作用 | 进入方式 |
| --- | --- | --- |
| **Reef** | 小型入口 | “悬停显示”模式的默认空闲状态；悬停展开状态栏，点击打开控制。 |
| **Compact** | 四个状态环与 Atoll 控制 | 悬停 Reef，或在设置中选择“始终显示”；继续悬停状态环即可打开详情。 |
| **Expanded** | 状态栏加 Home、媒体、音量、来源、耗电历史、Codex 用量或设置 | 悬停状态、点击边栏空白处固定，或通过快捷键、托盘打开；有意义的媒体或音量变化也可能打开相关控制。 |
| **Hidden** | 完全隐藏原生窗口 | 使用 Home 的 Hide，或在启用“全屏自动隐藏”时由前台全屏应用触发。 |

- 使用 `Ctrl + Shift + Space` 或左键单击托盘图标，在 Expanded 与当前可见的收起状态之间切换。
- 右键 Atoll 或托盘图标可打开快捷菜单、进入设置或退出。
- 悬停先展开状态栏，再显示对应状态详情；点击边栏空白处可固定或取消固定，键盘也可操作固定按钮；点击已启用的 Codex 状态环会刷新读数。未固定时，离开刘海约 450 毫秒后收为 Reef；选择“始终显示”时则收为状态栏。
- 事件或快捷键打开的面板，在鼠标位于外部且未固定时保留约 4 秒的空闲收起时间；键盘操作期间保留当前控制。`Escape` 收起控制；来源页先返回媒体页，耗电或 Codex 页先返回 Home。
- 在设置中选择“顶部”“底部”“左侧”或“右侧”，以及“悬停显示”或“始终显示”；两项偏好均在本地保存。
- 在 Home 中点击下方的电池卡可查看近 7 天。电池采样本身**不会**抢占岛体或自动打开历史页。
- 当有两个及以上应用来源时，进入媒体页后可选择“自动”或临时固定一个来源；选择只在本次运行中保留。
- 悬停 **Codex** 状态环，或在托盘、右键菜单选择 **Codex 用量**，均可打开其面板。它默认关闭，首次点击“启用”才是明确授权边界；普通更新不会打扰你，只有额度跨阈值或真实重置时才可能短暂浮现。

详细的状态尺寸、材质、动效和可访问性规则见 [DESIGN.md](DESIGN.md)。

## 兼容性与边界

- 仅支持 **Windows 11 x64**；停靠于**主显示器工作区**所选边缘的中央，避让任务栏并跟随布局变化；不提供拖动、手动缩放或指定显示器。
- 媒体控制只使用播放器实际发布给 Windows 的 GSMTC 元数据与能力。播放器没有发布封面、时间线、定位或某个传输控制时，Atoll 不会猜测或模拟。
- 进度定位还需要一个有效且至少 1 秒的媒体时长；未满足时进度仅供阅读。
- Atoll Connect 当前采用随应用一起编译、通过 PR 审核的源码 Provider，不支持运行时安装插件、加载第三方 DLL、进程注入或模拟播放器操作。
- 电池信息依赖设备和 Windows 驱动报告容量。台式机、没有电池的设备或不报告容量的设备会显示不可用，而不是伪造为零。
- 首次采样、此前退出应用、睡眠/阻塞导致的长间隔，或容量暂时不可用，都会让当天记录标为“部分记录”；Atoll 不会补算缺失时间。
- Codex 用量是可选功能，需要本机已安装、已使用受支持 ChatGPT/Codex 账号登录并支持 App Server 的 Codex CLI。仅 API Key 或 Bedrock 会话可能没有用量活动数据；Atoll 会诚实显示不可用，而不会伪造配额或重置时间。由于 CLI 接口仍在演进，App Server 的兼容性也可能变化。
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
| Codex 用量（可选） | 本机已安装、以受支持 ChatGPT/Codex 账号登录的 Codex CLI；Atoll 不会打包 Codex。 |

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

浏览器模式没有 Windows IPC，因此不能用来验收原生窗口、GSMTC、Core Audio、托盘、全屏检测或电池数据。布局样例入口为 `http://localhost:1420/?preview=expanded-media&edge=top`；`preview` 可选 `reef`、`compact-media`、`expanded-home`、`expanded-media`、`expanded-volume`、`expanded-energy`、`expanded-codex`、`expanded-sources` 或 `settings`，`edge` 可选 `top`、`bottom`、`left` 或 `right`。预览使用合成数据，不会启用原生 Codex 集成。

## 开发与验证

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Vite 前端开发服务器 |
| `pnpm tauri dev` | 启动完整 Tauri 开发应用 |
| `pnpm build` | TypeScript 类型检查并构建前端到 `dist/` |
| `pnpm test` | 运行 TypeScript/Node 逻辑测试，包括刘海几何、设置迁移与面板控制 |
| `node scripts/verify-notch.mjs` | 针对已启动的 Vite 服务器检查浏览器交互、内容溢出、四边布局并截取截图 |
| `node scripts/verify-notch-motion.mjs` | 采样四边弹簧动画，检查圆环尺寸、错峰、气泡滑动与收起 |
| `pnpm preview` | 预览已构建的前端产物 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 检查 Rust 格式 |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked` | 运行 Rust 测试且不修改锁文件 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | 将 Rust Clippy 警告视为错误 |

浏览器验证脚本使用已有的 Playwright 安装；请确保能解析 `playwright`，或将 `ATOLL_PLAYWRIGHT_MODULE` 指向其模块路径；应用没有新增 Playwright 依赖。脚本默认使用1425端口，可通过 `pnpm dev -- --port 1425` 启动；`ATOLL_PREVIEW_URL` 可覆盖 Vite 地址。原生行为仍需在 Windows 上验证。

提交前的完整本地检查：

```powershell
pnpm build
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## Codenotch 复刻边界

实现采用原仓库的 44/117 比例、圆角优先的圆弧轮廓、直立圆环排布、气泡宽度、颜色阈值和弹簧参数。轮廓在固定尺寸内容外展开；同一动画帧也生成 Windows 命中区域。设置、媒体、音量和耗电控制属于 Atoll 的功能扩展。

Windows 使用 Segoe UI 与 WebView2，原版使用 SF Pro 与 SwiftUI；曲线以每四分之一圆弧 12 段采样，同时用于 SVG 与 Win32，所以字体度量和像素渲染存在细微差别。气泡尾部遵循源码中的三角形，设计 PNG 的连接处则是曲线。详情见[复刻与验证记录](docs/codenotch-fidelity.md)和[上游声明](THIRD_PARTY_NOTICES.md)。

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
| [`src-tauri/`](src-tauri/) | Rust：原生窗口、GSMTC 媒体聚合、Core Audio、全屏检测、能源采样、可选的本机 Codex App Server 桥接、托盘和 NSIS 配置。 |
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

- 核心媒体、音量和电池功能不需要账号，其数据不会发送到网络。
- 设置保存在本机 WebView 的 local storage 中。
- 电池放电累计和最多 30 个已完成日的历史保存在 `%LOCALAPPDATA%\com.tsaiggo.atoll\energy-state.json`。删除该文件会清空耗电历史。
- Codex 用量默认关闭。启用后，Atoll 只会通过私有 stdio 启动本机已安装的 `codex app-server`，从当前 Codex 登录中请求聚合配额窗口、重置时间和 token 活动分桶；不会读取提示词、文件、账户 ID、API Key、cookie 或凭据文件，也不会调用登录、退出或消耗 reset credit。
- 诊断日志默认位于 `%LOCALAPPDATA%\com.tsaiggo.atoll\logs\Atoll.log`。提交 Issue 前请删除不希望公开的歌曲标题、本地路径、用户名或设备信息。
- 媒体数据只来自播放器主动公开给 Windows 的系统媒体会话；Atoll 不读取播放器账号或密码。

## 常见问题

### 为什么看不到播放器，或某些播放按钮不可用？

先确认播放器是否出现在 Windows 系统媒体面板。Atoll 只能读取它实际公开的 GSMTC 会话与能力；缺少封面、定位、上一首或下一首能力时，Atoll 不会自行补全。

### 为什么电池卡显示不可用、部分记录或很小的数值？

电池卡只在 Windows 能报告电池容量时可用。首次启动、睡眠、超过约 3 分钟的采样间隔，或驱动暂时不提供数据时，Atoll 会保留已知数据并标为“部分记录”，而不是估算空白时段。小于 10 Wh 时会显示 Wh 或 mWh，因此短时间内的变化不会被固定四舍五入成同一个 `0.01 度`。

### 为什么 Codex 用量不可用，或没有显示重置时间？

Codex 用量需要用户主动启用，并且依赖本机已安装、已使用受支持 Codex/ChatGPT 会话登录的 Codex CLI。请先从托盘菜单打开 **Codex 用量** 并启用，再确认 `codex app-server` 可用。仅 API Key 或 Bedrock 会话不会提供同样的账户用量活动；Atoll 不会抓取 Codex 界面或猜测缺失的限制，而会在官方本机 App Server 没有可用窗口时显示不可用。详见 [Codex App Server 官方文档](https://developers.openai.com/codex/app-server/)。

### Rust 构建找不到 `link.exe` 或 Windows SDK？

在 Visual Studio Installer 中为 Build Tools 2022 安装“使用 C++ 的桌面开发”工作负载，并确认包含 MSVC 与 Windows 10/11 SDK。安装完成后重新打开终端。

### Tauri 窗口空白或 WebView2 无法启动？

安装或修复 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)，然后重新启动 Atoll。

## License

Atoll 自身当前尚未包含 `LICENSE` 文件；代码公开可见不等于已授权复制、修改或再分发无关的 Atoll 代码。Codenotch 设计参考的 MIT 声明保留在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

---

<div align="center">
  <strong>Atoll</strong> · Your status, surfaced.
</div>
