# Atoll 工程架构

Atoll 是一个 Tauri 桌面应用，由两个独立编译、在运行时协作的部分组成：

- `src/`：运行在 WebView 中，负责产品状态、交互与界面渲染。
- `src-tauri/`：运行在原生进程中，负责 Windows API、窗口、后台监听、托盘与打包。

两者不应合并目录。边界上的通信统一经过 Tauri IPC；最终由 Tauri 将前端产物和 Rust 程序打包为同一个 Windows 应用。

## 前端 `src/`

```text
main.ts                 应用组合根：持有运行状态，协调事件、状态转换和副作用
app/types.ts            应用层类型与只读 AppViewModel
domain.ts               纯领域模型、数据规范化和时间计算
config.ts               全局设置及其 localStorage 持久化
features/
  media/commands.ts     媒体命令规则、乐观播放状态与媒体身份
platform/native.ts      唯一的 Tauri invoke/listen 封装
shell/geometry.ts       四边刘海尺寸、SVG 轮廓与原生命中区域的共享多边形
ui/
  render.ts             状态栏、状态环、浮动详情组合与焦点/进度更新
  compact.ts            旧 Compact 模板；新状态栏由 render.ts 组合
  expanded.ts           Expanded 各面板模板
  primitives.ts         封面、按钮、进度、状态文案等共享模板
  escape.ts             HTML 与 CSS URL 转义
icons.ts                SVG 图标
styles.css              Codenotch 参考的纯黑外壳、彩色状态环、布局与动效
```

`main.ts` 是协调器，不是通用工具箱。新增的纯逻辑、模板、持久化或平台调用应先放入对应模块，再由它组合。

## 原生端 `src-tauri/src/`

```text
main.rs          最小可执行入口
lib.rs           Tauri 组合根：注册插件、状态、watcher 和 commands
app_controls.rs  托盘、快捷键、菜单及应用级 action
runtime.rs       跨原生模块共享的并发状态、epoch 和窗口参数
shell.rs         工作区边缘定位、动画、DPI、共享多边形 HRGN 与布局变化
connect/
  mod.rs         Atoll Connect 组合根与稳定的媒体 IPC commands
  contract.rs    公开媒体 DTO、内部 Provider 状态与强类型 action
  provider.rs    ConnectProvider、事件出口与请求邮箱
  hub.rs         多 Provider 选择、全局 revision 与命令路由
  publisher.rs   状态缓存、去重与 media-update 事件发布
  runtime.rs     Tauri managed state 与同步命令入口
  providers/
    windows_gsmtc.rs  内置 Windows GSMTC Provider
volume.rs        Windows Core Audio 音量监听与默认输出设备控制
energy.rs        Windows 电池放电采样、日历史与本地持久化
codex_usage.rs   可选的本机 Codex App Server 用量/重置时间桥接
fullscreen.rs    前台全屏窗口检测
```

Rust 模块应通过 `runtime.rs` 共享状态，不应反向依赖 `lib.rs` 中的实现细节。`lib.rs` 只负责装配。

Atoll Connect 内部依赖方向为：

```text
connect::mod
  -> hub / providers / publisher / runtime
hub
  -> provider / contract
providers
  -> provider / contract / 平台 API
publisher / runtime
  -> contract / Tauri
```

Provider 只观察一个来源、发布结构化状态并执行强类型 action。它不能直接访问 Tauri managed state、发送 `media-update` 或决定公开的 `session_revision`。Connect Hub 是唯一的来源选择与命令路由者：它同时维护仅当前运行有效的“按应用来源”选择，并在来源消失时清除选择、恢复自动策略；Publisher 是唯一的前端媒体事件发布者。

## 依赖规则

前端依赖方向：

```text
main
  -> app / features / platform / shell / ui
ui
  -> AppViewModel / domain / shell / icons
features
  -> domain
platform
  -> IPC DTO 与必要的命令类型
domain
  -> 无浏览器、DOM、Tauri 依赖
```

必须遵守以下约束：

1. `ui/` 只根据显式传入的 `AppViewModel` 渲染，不读取应用全局状态，不调用 Tauri，也不写 localStorage。
2. `features/` 放可测试的功能规则，不操作 DOM；平台副作用由 `main.ts` 协调。
3. `platform/native.ts` 是前端唯一允许直接使用 `invoke` 和 `listen` 的文件。
4. `domain.ts` 保持纯净，可在没有浏览器和 Windows 的环境中测试。
5. 模块不得回头导入上层协调器。尤其禁止 `ui -> main`、`features -> main` 和原生子模块 `-> lib`。
6. 跨模块仅共享明确的类型或函数；不要新增隐式单例、重复状态调度器或第二套窗口状态。
7. 窗口尺寸与轮廓只从 `src/shell/geometry.ts` 的 `notchGeometry` 与 `codenotch.ts` 获取；兼容调用可通过 `SHELL_GEOMETRY`。SVG 绘制与 Windows 命中区域使用同一份多边形，修改时必须核对 `tauri.conf.json` 的初始窗口和 Rust 区域处理。

## IPC 契约

命令由前端发往 Rust：

| Command | 参数 | 返回 |
|---|---|---|
| `is_fullscreen_active` | 无 | `boolean` |
| `media_status` | 无 | `NativeMediaUpdatePayload` |
| `energy_status` | 无 | `NativeEnergyPayload` |
| `codex_usage_status` | 无 | 脱敏的 `CodexUsageState` 快照 |
| `codex_usage_set_enabled` | `enabled` | 更新后的 `CodexUsageState`；仅启用时才启动本机 Codex App Server |
| `codex_usage_refresh` | 无 | 当前 `CodexUsageState`，并请求一次低频刷新 |
| `set_window_shell` | 扁平的 `NativeShellRequest` 字段，包括 `edge` 与 `regions` | `void` |
| `show_context_menu` | 无 | `void` |
| `media_command` | `command`, `sessionRevision` | `boolean` |
| `media_seek` | `positionMs`, `sessionRevision` | `boolean` |
| `media_select_source` | 可选的 `providerId`, `sourceId`；两者均省略表示自动 | `boolean` |
| `set_system_volume` | `level`（0–1） | `boolean` |
| `set_system_mute` | `muted` | `boolean` |

事件由 Rust 发往前端：

| Event | Payload |
|---|---|
| `atoll-action` | `string` |
| `media-update` | `NativeMediaUpdatePayload` |
| `energy-update` | `NativeEnergyPayload` |
| `codex-usage-update` | 脱敏的 `CodexUsageState` |
| `system-volume` | `NativeVolumePayload` |
| `fullscreen-changed` | `{ fullscreen: boolean }` |

这些字符串和 payload 是跨语言 ABI。新增或修改契约时，应同时完成：Rust command/event 与序列化类型、`domain.ts` 中的 DTO、`platform/native.ts` 封装，以及调用方验证。业务层不得直接复制 IPC 字符串。

Tauri 调用参数在 TypeScript 中使用 camelCase，例如 `sessionRevision`；Rust command 参数保持 snake_case，例如 `session_revision`，由 Tauri 完成映射。

## 刘海状态、几何与窗口命中

`config.ts` 持久化 `notchEdge: top | bottom | left | right` 与 `notchVisibility: auto | always`。旧设置、缺失或无效值迁移为 `top` / `auto`，保留既有语言、全屏策略和 Codex 的显式启用状态。`topMargin` 只保留为值为 `0` 的兼容字段，不再持久化或参与原生定位。

`main.ts` 持有唯一的 shell、当前详情与固定状态。悬停 Reef 显示状态栏，悬停模块 100 毫秒后显示详情；离开模块、回到栏内空白处 250 毫秒后隐藏未固定详情。点击栏内空白处切换固定，点击已启用的 Codex 环刷新读数，点击设置圆弧打开并固定设置。离开整体 450 毫秒后收起；`always` 回到状态栏，`auto` 回到 Reef。事件或快捷键打开的未固定详情保留 4 秒空闲计时，键盘、拖动和正在提交的控制保留当前面板。

`codenotch.ts` 保存源设计的 44/117 比例：侧栏深约 69.95 DIP、横栏深约 97.07 DIP，圆环 44 DIP；侧栏的节距包含文字行，横栏节距不包含文字。Reef 约 78.97 × 9.78 DIP。常用详情宽 225.64 DIP：媒体/Codex 高176、音量120、能耗224；设置360×320，管理面板300×210。后两者是 Atoll 扩展。透明宿主在各状态间保持尺寸不变，预留气泡与弹簧超出终点的空间。

`ui/notch-motion.ts` 只持有展示插值，不另建业务状态。`shell/motion.ts` 计算源弹簧：展开 .42/.78，内容 .36/.82（每项延迟45ms，最多180ms），气泡 .5/.86，读数 .9/.9；交叉淡化160ms。response 是固有周期，不是持续时间。重绘从当前几何继续，内容保持完整排版、通过动态轮廓裁切；退出的内容只以 inert 副本短暂保留。降低动态效果偏好跳过插值。

每一帧先经 `platform/native.ts` 送入 `set_window_shell(animated:false)`，再绘制同一轮廓；Rust 不再作为这条路径的第二个动画时钟。共享多边形按实际 DPI 转换，通过 `CreatePolygonRgn` 与 `CombineRgn(RGN_OR)` 合成 HRGN。面板、状态栏和设置之间仅保留狭窄的指针通道；透明宿主的其余空间不接收点击。Win32 用 `SW_SHOWNOACTIVATE` 展示并保留 `WS_EX_NOACTIVATE` / `WS_EX_TOOLWINDOW`，避免通用 show 路径改写窗口样式。

原生宿主以主显示器 **工作区** 定位，依据所选边缘居中；工作区包含任务栏避让。显示器、缩放、工作区或任务栏布局变化后，原生 watcher 用当前边缘和共享区域恢复定位。外壳使用不透明纯黑材质，不再启用或脉冲刷新 Acrylic。设计来源与上游声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 布局验证边界

`?preview=expanded-media&edge=top` 等浏览器入口使用合成数据，仅验证布局，不连接 Windows IPC 或自动启用 Codex。`scripts/verify-notch.mjs` 在已启动的 Vite 服务上检查四边布局、控件交互、内容溢出并保存截图；`scripts/verify-notch-motion.mjs` 采样四边的实际动画帧，核对固定圆环尺寸、错峰、气泡滑动和收起。两个脚本默认使用1425端口；它们依赖已有 Playwright（通过模块解析或 `ATOLL_PLAYWRIGHT_MODULE`），不增加应用依赖。原生 DPI、任务栏避让、HRGN 点击穿透和实际媒体/音量仍需独立 Windows 验证。

## 新功能放置规则

- 新的纯业务规则：`src/features/<feature>/`。
- 新的界面或模板：`src/ui/`，输入应是显式 ViewModel。
- 新的共享领域类型或纯计算：`src/domain.ts`；内容继续增长时再拆为 `src/domain/`。
- 功能专属浏览器持久化：`src/features/<feature>/storage.ts`；全局设置仍放 `config.ts`。
- 新的 Tauri command/event 调用：先加入 `platform/native.ts`，再由 `main.ts` 或功能协调器使用。
- 新的窗口形态或尺寸：`src/shell/`，并同步原生窗口与 CSS 约定。
- 新的 Windows 系统能力：`src-tauri/src/<feature>.rs`；在 `lib.rs` 注册，在 `platform/native.ts` 暴露最小接口。
- Codex 账户状态：独立放在 `src-tauri/src/codex_usage.rs`，不可塞入媒体 `connect/` Hub。它只可通过固定的本机 `codex app-server --stdio` 读取聚合窗口；不得读取凭据文件、暴露原始 JSON-RPC，或调用登录、对话、退出、reset-credit 操作。
- 新的媒体来源：`src-tauri/src/connect/providers/<provider>.rs`；实现 `ConnectProvider` 并在 `providers/mod.rs` 显式注册。兼容 GSMTC 的播放器应复用现有 Windows Provider。
- 托盘、快捷键和应用菜单：`src-tauri/src/app_controls.rs`。
- 跨原生模块的并发状态：`src-tauri/src/runtime.rs`。

如果一个功能同时包含 UI 和 Windows 能力，应保持垂直切分：Rust 提供最小系统接口，`platform/native.ts` 承接 IPC，`features/` 保存规则，`ui/` 负责展示，`main.ts` 只负责把它们连接起来。
