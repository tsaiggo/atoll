# Atoll

<div align="center">
  <img src="assets/atoll-icon.svg" width="96" height="96" alt="Atoll logo">
  <p><strong>重要状态，浮现于顶端。</strong><br>Your status, surfaced.</p>
  <p>
    <img alt="Version 0.1.0" src="https://img.shields.io/badge/version-0.1.0-16786c">
    <img alt="Windows 11" src="https://img.shields.io/badge/platform-Windows%2011-0078d4?logo=windows11&amp;logoColor=white">
    <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-24c8db?logo=tauri&amp;logoColor=white">
    <img alt="Rust and TypeScript" src="https://img.shields.io/badge/Rust%20%2B%20TypeScript-202020">
  </p>
</div>

Atoll 是一款面向 Windows 11 的顶部动态状态中心。它固定在主显示器顶部居中，并以贴住屏幕上边缘的方式出现；空闲时收缩为极小的 **Reef**，点击 Reef 即可展开。切歌或音量变化时，它会自动打开相关控制，并在无交互后安静收回，让媒体控制和系统状态始终触手可及，又不会长期占据桌面空间。

Atoll 借鉴了 iPhone Dynamic Island 的“状态先出现、内容随后展开”交互语法，但不是逐像素复刻，也不使用 Apple 的品牌资产。它是一个拥有独立 Windows 身份的 **Windows Status Island**：借鉴 Windows Widgets Board 的 Acrylic 材质语言，用 Segoe UI、Windows 媒体会话和原生窗口能力完成信息层级、动画与系统集成。

> [!IMPORTANT]
> Atoll `0.1.0` 仍处于早期开发阶段，目前仅面向 Windows 11。仓库暂未发布预编译安装包；你可以按照下文从源码运行或构建 NSIS 安装包。

## 视觉与交互

Atoll 使用一个连续的 Windows Widgets 风格 Acrylic 圆角岛体，而不是照搬 Widgets Board 的网格。Acrylic 材质由 WebView 直接绘制：深色/浅色分别采用中性灰的半透明 Pane 底材，配合极轻的顶部反射和安静的内部内容背板，被圆角及匹配的原生窗口区域裁剪，因此不会出现矩形背衬；“减少透明度”时改用对应主题的实体材质。外壳统一使用 12 DIP 的克制圆角，内部控件使用更小的 7–8 DIP 圆角；岛体尺寸、圆角和原生点击区域同步变化。展开、切歌、调音量或点按播放控制时，透明 WebGL 层会短暂扫过一条中性流光，随后立即停止渲染。

当前 UI 不将仓库中的历史设计图或开发截图当作产品真相；请以运行中的 Tauri 窗口和 [`DESIGN.md`](DESIGN.md) 中的设计契约为准。

## 为什么是 Atoll

- **只在需要时出现**：点击 Reef 或发生媒体/音量事件时，Atoll 展开为 Expanded；约 4 秒无交互后收为可唤起的 Reef。
- **不打断当前工作**：窗口不抢焦点、不进入普通任务栏列表，并在全屏应用中自动隐藏。
- **像一个状态岛，而不是组件面板**：Windows Widgets 风格的 Acrylic 材质会随浅色和深色主题改变；媒体封面、标题、进度和主控按钮从同一个岛体中展开。
- **遵循 Windows**：使用 Segoe UI、Windows 媒体会话、Core Audio 事件与系统“减少动画”设置。
- **状态可预测**：窗口尺寸、自动收起和媒体来源选择都有明确规则。
- **反馈有层次**：媒体会话作为持续状态，音量变化只短暂浮现，不会长期占据桌面。
- **本地优先**：不需要账号，不上传媒体信息，没有遥测、广告或云端依赖。

## 当前能力

### 桌面外壳

- Hidden、Reef、Compact、Expanded 四种原生窗口状态。
- 固定在主显示器顶部居中，不可拖动或调整尺寸。
- 支持高 DPI、负坐标和显示器配置变化后的自动重定位。
- 始终置顶但不抢焦点；透明圆角区域不会截获底层窗口点击。
- Widgets 风格 Acrylic 外壳在 Windows 浅色/深色主题中切换，媒体进度与主控采用对应主题的高对比中性色，Reef 与键盘焦点保留少量信号色。
- 尊重系统“减少动画”设置。
- 单实例运行，提供托盘菜单、右键菜单与 `Ctrl + Shift + Space` 全局快捷键。

### Atoll Connect：当前媒体

- 通过 Windows Global System Media Transport Controls（GSMTC）读取兼容播放器的公开媒体会话。
- 当前内置来源为 `builtin.windows-media-session`；Connect Hub 统一聚合来源、选择当前媒体并路由控制命令。
- 支持 QQ 音乐、Spotify、浏览器等会向 Windows 发布媒体状态的应用。
- 展示封面、标题、艺术家、来源、播放状态与真实时间进度。
- 根据播放器公布的能力提供上一首、播放/暂停、下一首；不支持的控制会自动禁用。
- 当播放器通过 GSMTC 公布可定位能力时，Expanded 媒体页的真实时间线可点击或拖动定位；未公布该能力时保留为只读进度，不会展示无效滑杆。
- 多播放器并存时，依次参考正在播放、Windows 当前会话和此前已选中的来源，避免界面频繁跳动。
- 当检测到两个及以上**应用来源**时，Expanded 媒体页底部可以选择“自动”或临时固定一个来源。选择只在本次运行中有效；来源的媒体会话消失后会安全回到自动选择。浏览器标签页不会被误当作独立来源。

### 系统反馈

- 监听 Windows Core Audio 音量与静音变化，并自动展开对应的快捷控制。
- 检测前台全屏应用并自动隐藏；离开全屏后恢复到当时有效的状态。
- 音量模块可直接静音/恢复，并通过 Expanded 首页中的滑杆调节默认输出设备的主音量。

## 窗口状态与自动收起

| 状态 | 尺寸（DIP） | 用途 | 默认行为 |
| --- | ---: | --- | --- |
| Hidden | — | 原生窗口不可见 | 由全屏策略或界面中的 Hide 触发 |
| Reef | `96 × 32` | 空闲入口 | 点击后打开 Atoll |
| Compact | `256 × 56` | 轻量上下文状态 | 仅在需要简短状态表达时使用，不会因持续播放而常驻 |
| Expanded | `400 × 176` | 媒体详细控制与设置 | 点击 Reef、切歌或音量变化时打开；默认约 4 秒无交互后收起 |

表中是可见尺寸，均为逻辑像素（DIP）。为实现真正的贴顶效果，原生 host 会额外向屏幕外延伸 12 DIP（Reef `96 × 44`、Compact `256 × 68`、Expanded `400 × 188`）；显示器边缘裁掉上方圆角，左右和下方仍保留克制的 Acrylic 留边。原生窗口尺寸、可见圆角和命中区域同时过渡，且内容会等待原生几何稳定后再进入，避免圆角透明区拦截底层应用的点击或在过渡中跳位。

“自动收起”会把 Expanded 回落到 Reef。媒体/音量事件会刷新这段等待时间；在 Expanded 中进行鼠标、滚轮或键盘操作也会刷新。需要完全隐藏时，可使用 Expanded 首页的 Hide 或全屏自动隐藏；手动隐藏和前台全屏期间，新的系统事件不会强行将岛体重新弹出。

## 使用方式

- 点击 Reef 打开 Atoll；仅悬停不会展开，避免指针经过顶部时打断工作。
- 使用 `Ctrl + Shift + Space` 在 Expanded 与当前有效的收起状态之间切换。若快捷键已被其他应用占用，Atoll 仍会正常启动，并记录冲突。
- 左键单击托盘图标可执行同样的切换；右键 Atoll 或托盘图标可打开快捷菜单、进入设置或退出。
- Expanded 首页底部的 Hide 可让 Atoll 完全隐藏；再次使用快捷键或托盘入口即可唤回。
- 在设置中可切换中英文和全屏自动隐藏。媒体/音量事件触发展开后，默认约 4 秒会回到 Reef。
- 当两个或更多应用同时发布 Windows 媒体会话时，点击 Expanded 媒体页底部的来源行即可选择播放来源；列表中的“自动”会恢复系统的智能选择。
- 支持定位的播放器可在 Expanded 媒体页点击或拖动时间线跳转；拖动、请求确认和其他媒体控制会短暂互斥，避免把位置命令发送给刚切换的曲目或来源。

## 环境要求

构建完整 Windows 桌面应用需要以下环境：

| 依赖 | 要求 | 说明 |
| --- | --- | --- |
| 操作系统 | Windows 11 x64 | Atoll 当前使用 Windows 专属 API，不能在 macOS/Linux 上完整构建或运行 |
| Visual Studio Build Tools 2022 | “使用 C++ 的桌面开发”工作负载 | 需要 MSVC、Windows 10/11 SDK 与 `link.exe` |
| WebView2 Runtime | 当前稳定版 | Windows 11 通常已内置；缺失时需安装 Evergreen Runtime |
| Node.js | `^20.19.0` 或 `>=22.12.0` | 来自当前 Vite 版本的运行时要求；Node 21 不在支持范围内 |
| pnpm | 11.x | 仓库包含 pnpm v9 格式的锁文件；当前开发环境使用 pnpm 11 |
| Rust | stable 1.88+，MSVC toolchain | 使用 `x86_64-pc-windows-msvc` 工具链 |
| Git | 当前稳定版 | 克隆仓库与提交变更 |

官方安装文档：

- [Tauri 2 Windows prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Node.js downloads](https://nodejs.org/en/download)
- [pnpm installation](https://pnpm.io/installation)
- [Install Rust](https://www.rust-lang.org/tools/install)
- [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

安装 pnpm 11 的一种方式：

```powershell
npm install --global pnpm@latest-11
pnpm --version
```

安装 Rust 后，确认当前使用 MSVC 工具链：

```powershell
rustup default stable-msvc
rustc --version
cargo --version
```

## 从源码运行

```powershell
git clone https://github.com/tsaiggo/atoll.git
cd atoll
pnpm install --frozen-lockfile
pnpm tauri dev
```

`pnpm tauri dev` 会同时启动 Vite 前端开发服务器和 Tauri/Rust 原生宿主，这是验证窗口、媒体、音量、托盘、全局快捷键与全屏行为的标准方式。

如果只需要在浏览器中调试界面，可以运行：

```powershell
pnpm dev
```

浏览器模式不会提供真实 Windows IPC，因此不能用来验收窗口定位、媒体会话、Core Audio、托盘或全屏检测。

## 常用开发命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 仅启动 Vite 前端开发服务器 |
| `pnpm tauri dev` | 启动完整的 Tauri 开发应用 |
| `pnpm build` | 执行 TypeScript 类型检查并构建前端到 `dist/` |
| `pnpm test` | 运行 TypeScript/Node 逻辑测试 |
| `pnpm preview` | 预览已经构建的前端产物 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 检查 Rust 格式 |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked` | 运行 Rust 测试，并禁止隐式修改锁文件 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | 将 Rust Clippy 警告视为错误 |
| `pnpm tauri build --bundles nsis --ci` | 构建发布版程序与 NSIS 安装包 |

## 构建 Windows 可执行文件与安装包

### 1. 完成发布前检查

先从 Atoll 托盘菜单退出正在运行的实例，然后在仓库根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

### 2. 构建 NSIS 安装包

```powershell
pnpm tauri build --bundles nsis --ci
```

这条命令会依次完成前端生产构建、Rust release 编译、资源嵌入与 NSIS 打包。只运行 `pnpm build` **不会**生成 Windows 安装包。

### 3. 获取构建产物

版本 `0.1.0`、x64 Windows 环境下的默认产物为：

```text
src-tauri/target/release/atoll.exe
src-tauri/target/release/bundle/nsis/Atoll_0.1.0_x64-setup.exe
```

- `atoll.exe` 是未安装的 release 可执行文件，适合本机快速验收。
- `Atoll_0.1.0_x64-setup.exe` 是可以分发的 NSIS 安装器。

可以在 PowerShell 中直接启动它们：

```powershell
& ".\src-tauri\target\release\atoll.exe"
& ".\src-tauri\target\release\bundle\nsis\Atoll_0.1.0_x64-setup.exe"
```

当前 NSIS 配置使用 `currentUser` 安装模式，默认不请求管理员权限，并安装到当前用户目录。安装器使用 Tauri 默认的 WebView2 `downloadBootstrapper` 策略：目标机器缺少 WebView2 时，安装过程需要联网获取 Runtime。

> [!WARNING]
> 当前构建尚未配置 Authenticode 代码签名。Windows SmartScreen 可能对自行构建或下载的安装包显示“未知发布者”。这不等同于构建失败；正式发布前应使用可信代码签名证书签署安装包。

Atoll 当前也没有应用内自动更新器。重复运行新版本安装器可用于覆盖安装测试，但发布前仍应手动验证安装、启动、覆盖升级与卸载流程。

### 发布检查清单

仓库目前没有自动发布工作流。准备发布新版本时，建议至少完成：

- [ ] 同步更新 `package.json`、`src-tauri/Cargo.toml` 与 `src-tauri/tauri.conf.json` 中的版本号。
- [ ] 更新锁文件，并在干净工作区执行全部检查命令。
- [ ] 构建 NSIS 安装包，检查文件名、图标、版本信息和安装范围。
- [ ] 在一台干净的 Windows 11 环境验证首次安装、启动、覆盖升级与卸载。
- [ ] 验证 100%、125%、150% 和 200% 缩放下的顶部居中与圆角命中区域。
- [ ] 验证浅色/深色 Windows 环境下的深色岛体、全屏隐藏、媒体控制和音量反馈。
- [ ] 对安装包进行 Authenticode 签名并再次验证签名状态。
- [ ] 创建 Git tag，在 [GitHub Releases](https://github.com/tsaiggo/atoll/releases) 发布安装器、校验值与变更说明。

## 工程架构

Atoll 由两个独立编译、运行时协作的部分组成：

```text
Atoll
├─ src/                         WebView 应用：状态、交互与界面
│  ├─ app/                     应用层类型与 ViewModel
│  ├─ features/                媒体命令等功能规则
│  ├─ platform/                Tauri IPC 的唯一前端入口
│  ├─ shell/                   Reef / Compact / Expanded 几何定义
│  └─ ui/                      视图模板与共享组件
├─ src-tauri/                  Windows 原生宿主与打包配置
│  └─ src/
│     ├─ shell.rs              窗口、DPI、定位、动画与命中区域
│     ├─ connect/              媒体来源契约、聚合、命令路由与发布
│     │  └─ providers/         随 Atoll 编译的已审核来源实现
│     ├─ volume.rs             Windows Core Audio 监听
│     ├─ fullscreen.rs         前台全屏检测
│     └─ app_controls.rs       托盘、菜单与全局快捷键
├─ assets/                     品牌资源
├─ artifacts/                  设计研究与验收过程产物（非当前 UI 的权威来源）
├─ ARCHITECTURE.md             职责边界、依赖规则与 IPC 契约
└─ DESIGN.md                   视觉系统与组件规则
```

```text
src/（TypeScript / HTML / CSS）
             ⇅ Tauri IPC
src-tauri/（Rust / Windows API）
             ↓
       NSIS installer
```

`src/` 与 `src-tauri/` 不应合并为一个目录：前者运行在 WebView 中，后者是拥有 Windows API 权限的原生进程。详细规则见 [ARCHITECTURE.md](ARCHITECTURE.md)，视觉修改前请阅读 [DESIGN.md](DESIGN.md)。

## 如何贡献

欢迎提交 Bug、兼容性报告、文档改进与聚焦的功能变更。当前贡献规则直接维护在本 README 中。

### 报告问题

请先搜索 [GitHub Issues](https://github.com/tsaiggo/atoll/issues)，避免重复报告。新 Issue 建议包含：

- Windows 11 版本、显示器布局与缩放比例。
- Atoll commit 或版本，以及是否从源码运行。
- 可稳定复现的最短步骤、预期行为与实际行为。
- 涉及媒体时，注明播放器名称、版本和是否能在 Windows 系统媒体面板中看到该会话。
- 必要的截图或日志；上传前请移除不希望公开的歌曲、账号、用户名与本地路径。

### 提交代码

1. Fork 仓库并从最新 `main` 创建描述清晰的分支。
2. 阅读 [ARCHITECTURE.md](ARCHITECTURE.md)；涉及界面时同时阅读 [DESIGN.md](DESIGN.md)。
3. 保持改动聚焦，不在同一个 PR 中混入无关重构或生成物。
4. 为纯逻辑补充测试；涉及 Windows 原生行为时完成实机 smoke test。
5. 运行完整检查，并在 PR 中记录结果。
6. 推送分支并创建 Pull Request。

建议使用简短、祈使语气的英文 commit，例如：

```text
Fix expanded auto-collapse timing
Add media session fallback tests
Document NSIS release workflow
```

### 贡献 Atoll Connect Provider

现阶段 Provider 采用刻意精简的源码贡献模式：实现会随 Atoll 一起编译，由维护者通过 Pull Request 审核，不支持运行时安装插件、加载第三方 DLL 或注入自定义界面。这样既能扩展来源，也不会过早引入插件商店、签名、权限和沙箱体系。

兼容 GSMTC 的播放器已经由 `builtin.windows-media-session` 覆盖，不需要为 QQ 音乐、Spotify 或浏览器分别复制一套 Provider。只有来源不发布 GSMTC，或确实能补充歌词等系统接口没有的数据时，才适合新增实现。

新增 Provider 时：

1. 在 `src-tauri/src/connect/providers/` 下创建独立模块，实现 `ConnectProvider`，并在 `providers/mod.rs` 注册。
2. 使用稳定且唯一的 Provider ID；每个可控制目标提供稳定的 `target_id`，目标变化时递增 Provider 自己的 generation。
3. 只发布结构化状态并处理强类型 `MediaAction`。Provider 不直接依赖 Tauri、不发送前端事件，也不提供 HTML/CSS；公开 UI、来源选择和 `session_revision` 由 Connect Hub 统一管理。
4. 为状态映射、能力映射和失败回退补充测试；可复用现有 Fake Provider 测试方式验证多来源选择、命令路由与旧命令拒绝。
5. 在 PR 中说明所需的 Windows API、网络或本地数据访问，附上支持的软件版本和 Windows 11 实机验证结果。

这一阶段的 Provider 是仓库内部 Rust 接口，不承诺独立二进制 ABI。接口调整会与实现一起在同一个 PR 中审核和编译验证。

### Pull Request 应包含

- 解决的问题，以及为什么选择当前方案。
- 影响到的 UI、IPC、Windows API 或持久化边界。
- 实际执行过的测试命令与手工验证场景。
- UI 变更的 before/after 截图，至少覆盖 Windows 浅色和深色桌面环境。
- 涉及窗口几何时，注明验证过的 DPI 和多显示器布局。

提交前可以复制下面的清单：

```markdown
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --locked`
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- [ ] 已在 Windows 11 Tauri 窗口中完成 smoke test
- [ ] UI 变更已验证 Windows 浅色 / 深色环境与常见 DPI
- [ ] 没有提交个人媒体信息、日志、密钥或无关生成物
```

较大的产品方向、IPC 变更或新的 Windows 权限需求，建议先创建 Issue 讨论，避免投入后才发现边界不一致。

## 隐私与本地数据

- Atoll 不要求登录，不包含广告、分析、遥测或云同步。
- 媒体信息来自播放器主动发布给 Windows 的 GSMTC 会话；Atoll 不读取播放器账号或密码。
- 设置保存在本机 WebView 的 local storage 中。
- 诊断日志默认位于 `%LOCALAPPDATA%\com.tsaiggo.atoll\logs\Atoll.log`。
- 日志级别为 Info，单个日志文件上限约 250 KB，并仅保留一个轮换文件。

报告问题时请先检查日志内容，并删除你不希望公开的媒体标题、路径或设备信息。

## 常见问题

### `pnpm install` 或 `pnpm build` 报 Node engine 错误

确认 Node.js 为 20.19+ 的 20.x 版本，或 22.12 及以上版本。Node 21 不满足当前 Vite 的 engine 范围。

### Rust 构建找不到 `link.exe`、Windows SDK 或 C++ 工具

打开 Visual Studio Installer，为 Build Tools 2022 安装“使用 C++ 的桌面开发”工作负载，并确认包含 MSVC 与 Windows 10/11 SDK。安装完成后重新打开终端。

### Tauri 窗口空白或 WebView2 启动失败

安装或修复 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)，然后重新启动 Atoll。

### `pnpm tauri dev` 提示端口 `1420` 已被占用

退出另一个 Atoll/Vite 开发实例，或找到占用 `127.0.0.1:1420` 的进程后再启动。Tauri 开发配置固定连接该地址。

### 看不到播放器或某个按钮不可用

先检查该播放器是否出现在 Windows 系统媒体面板。Atoll 只能读取播放器实际发布的 GSMTC 会话和控制能力；播放器未发布封面、时间线、定位、上一首或下一首时，Atoll 无法自行补全。

### 首次打包为什么需要联网

Tauri/NSIS 的相关工具与 WebView2 bootstrapper 可能需要在首次构建时下载并缓存。缓存完成后，后续构建通常可复用本地文件。

### 安装包显示“未知发布者”

当前项目没有代码签名配置。自行构建的安装包会触发 SmartScreen 属于预期现象；公开分发前应添加 Authenticode 签名。

## 当前限制

- 仅支持 Windows 11，且固定在主显示器顶部居中。
- 不提供移动、手动缩放、指定显示器或左/右对齐界面。
- 不运行在 Windows 锁屏或 Windows Widgets 面板中。
- 媒体来源支持自动选择或仅本次运行的手动固定；进度定位仅适用于播放器通过 GSMTC 明确公布 `can_seek` 的会话，Atoll 不提供进程注入或模拟拖动作为回退。
- 音量控制仅作用于当前默认输出设备；暂不支持在 Atoll 中切换输出设备。
- 设置页暂未提供开机启动、模块开关、托盘开关、快捷键编辑或超时编辑。
- 没有内置更新器、自动发布工作流和正式代码签名流程。

## 技术栈

- [Tauri 2](https://tauri.app/)：Windows 原生宿主、WebView、IPC 与 NSIS 打包。
- [Rust](https://www.rust-lang.org/)：窗口策略、Windows API 与后台监听。
- [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)：状态、交互与前端构建。
- Windows GSMTC、Core Audio、DWM/GDI：媒体、音量、窗口材质与命中区域。

## License

本仓库目前**尚未包含 `LICENSE` 文件**。源代码虽然公开可见，但在添加明确许可证之前，默认版权仍由作者保留，不能据此假定拥有复制、修改或再分发权。

如果项目准备正式对外开源，维护者需要先选择并添加合适的许可证（例如 MIT、Apache-2.0 或 GPL-3.0），再更新本节与仓库元数据。

---

<div align="center">
  <strong>Atoll</strong> · Your status, surfaced.
</div>
