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
  timer/storage.ts      计时器 localStorage 读写和损坏数据回退
platform/native.ts      唯一的 Tauri invoke/listen 封装
shell/geometry.ts       Reef、Compact、Expanded 的窗口几何常量
ui/
  render.ts             根据 AppViewModel 选择视图并更新媒体进度
  compact.ts            Compact 视图模板
  expanded.ts           Expanded 各面板模板
  primitives.ts         封面、按钮、进度、状态文案等共享模板
  escape.ts             HTML 与 CSS URL 转义
icons.ts                SVG 图标
styles.css              Fluent 视觉、布局、状态和动效
```

`main.ts` 是协调器，不是通用工具箱。新增的纯逻辑、模板、持久化或平台调用应先放入对应模块，再由它组合。

## 原生端 `src-tauri/src/`

```text
main.rs          最小可执行入口
lib.rs           Tauri 组合根：注册插件、状态、watcher 和 commands
app_controls.rs  托盘、快捷键、菜单及应用级 action
runtime.rs       跨原生模块共享的并发状态、epoch 和窗口参数
shell.rs         原生窗口定位、动画、DPI、圆角区域和显示器变化
media.rs         Windows Global System Media Transport Controls
volume.rs        Windows Core Audio 音量监听
fullscreen.rs    前台全屏窗口检测
timer.rs         不依赖 WebView 活跃状态的后台计时调度
```

Rust 模块应通过 `runtime.rs` 共享状态，不应反向依赖 `lib.rs` 中的实现细节。`lib.rs` 只负责装配。

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
6. 跨模块仅共享明确的类型或函数；不要新增隐式单例、重复计时器或第二套窗口状态。
7. 窗口尺寸只从 `SHELL_GEOMETRY` 读取。修改尺寸时还必须核对 `tauri.conf.json` 的初始窗口、CSS 外形和 Rust 窗口区域。

## IPC 契约

命令由前端发往 Rust：

| Command | 参数 | 返回 |
|---|---|---|
| `is_fullscreen_active` | 无 | `boolean` |
| `media_status` | 无 | `NativeMediaUpdatePayload` |
| `set_window_shell` | `NativeShellRequest` | `void` |
| `show_context_menu` | 无 | `void` |
| `media_command` | `command`, `sessionRevision` | `boolean` |
| `schedule_timer` | `endAtMs`, `breakFullscreen` | `void` |

事件由 Rust 发往前端：

| Event | Payload |
|---|---|
| `atoll-action` | `string` |
| `media-update` | `NativeMediaUpdatePayload` |
| `system-volume` | `NativeVolumePayload` |
| `timer-elapsed` | `boolean` |
| `fullscreen-changed` | `{ fullscreen: boolean }` |

这些字符串和 payload 是跨语言 ABI。新增或修改契约时，应同时完成：Rust command/event 与序列化类型、`domain.ts` 中的 DTO、`platform/native.ts` 封装，以及调用方验证。业务层不得直接复制 IPC 字符串。

Tauri 调用参数在 TypeScript 中使用 camelCase，例如 `sessionRevision`；Rust command 参数保持 snake_case，例如 `session_revision`，由 Tauri 完成映射。

## 新功能放置规则

- 新的纯业务规则：`src/features/<feature>/`。
- 新的界面或模板：`src/ui/`，输入应是显式 ViewModel。
- 新的共享领域类型或纯计算：`src/domain.ts`；内容继续增长时再拆为 `src/domain/`。
- 功能专属浏览器持久化：`src/features/<feature>/storage.ts`；全局设置仍放 `config.ts`。
- 新的 Tauri command/event 调用：先加入 `platform/native.ts`，再由 `main.ts` 或功能协调器使用。
- 新的窗口形态或尺寸：`src/shell/`，并同步原生窗口与 CSS 约定。
- 新的 Windows 系统能力：`src-tauri/src/<feature>.rs`；在 `lib.rs` 注册，在 `platform/native.ts` 暴露最小接口。
- 托盘、快捷键和应用菜单：`src-tauri/src/app_controls.rs`。
- 跨原生模块的并发状态：`src-tauri/src/runtime.rs`。

如果一个功能同时包含 UI 和 Windows 能力，应保持垂直切分：Rust 提供最小系统接口，`platform/native.ts` 承接 IPC，`features/` 保存规则，`ui/` 负责展示，`main.ts` 只负责把它们连接起来。
