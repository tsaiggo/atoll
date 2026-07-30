# Atoll

Atoll 是一款面向 Windows 11 的顶部动态状态中心。它在空闲时收缩为极小的 Reef，需要时以 Compact 或 Expanded 形态浮现，用来查看和操作当前媒体、专注计时器与系统音量反馈。

> 重要状态，浮现于顶端。
> Your status, surfaced.

## 当前能力

- Hidden、Reef、Compact、Expanded 四种原生窗口形态
- 主显示器顶部居中定位，支持高 DPI、负坐标与显示器变化后的自动重定位
- 不抢焦点、不进入普通任务栏列表，并用真实窗口区域避免透明角落截获点击
- 单实例、托盘入口、右键菜单和 `Ctrl + Shift + Space` 全局快捷键
- Windows 当前媒体会话读取：封面、标题、艺术家、播放状态、上一首、播放/暂停、下一首
- 基于真实结束时间的专注计时器：5/10/25 分钟、暂停、继续、取消、重启与粘性完成状态
- Core Audio 音量与静音事件反馈
- 全屏应用自动隐藏，离开全屏后恢复有效状态
- 本地设置与计时器持久化；无账号、遥测、分析或云端依赖
- Idle、Media Playing、Volume、Timer Running、Timer Finished 共五种 Demo

## 环境

- Windows 11 与 WebView2 Runtime
- Node.js 20+ 与 pnpm
- Rust stable（MSVC toolchain）
- Visual Studio Build Tools / Windows SDK

## 启动

```powershell
pnpm install
pnpm tauri dev
```

构建 NSIS 安装包：

```powershell
pnpm tauri build
```

只验证前端和 Rust：

```powershell
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```

## 使用

- 点击顶部 Reef 打开 Atoll。
- 点击 Compact 展开当前状态的详细控制。
- 使用 `Ctrl + Shift + Space` 显示、展开或收起 Atoll；快捷键冲突不会阻止应用启动。
- 右键 Atoll 或使用托盘菜单可显示/隐藏、展开/收起、切换 Demo、打开设置或退出。
- Expanded 首页提供 5、10、25 分钟专注计时。
- 设置面板当前支持动画、全屏隐藏和 Idle 使用 Reef/Hidden；修改会立即生效并在重启后保留。
- 默认全屏策略是始终隐藏；计时器完成状态会保留，离开全屏后立即显示。

媒体信息来自 Windows Global System Media Transport Controls。播放器未发布媒体会话或不支持某个操作时，Atoll 会保持稳定并禁用相应控制，不伪造进度。

## 视觉验证

以下图片均从真实 Tauri/Windows 运行窗口抓取：

- [Reef](artifacts/screenshots/reef-native.jpg)
- [Compact 媒体 Demo](artifacts/screenshots/compact-media-native.jpg)
- [Expanded 媒体 Demo](artifacts/screenshots/expanded-media-native.jpg)
- [Timer Finished](artifacts/screenshots/timer-finished-native.jpg)
- [真实 Windows 媒体 Compact](artifacts/screenshots/compact-media-real-native.jpg)
- [真实 Windows 媒体 Expanded](artifacts/screenshots/expanded-media-real-native.jpg)

## 项目结构

- `src/`：状态优先级、界面、设置与计时器表现层
- `src-tauri/src/`：窗口壳、媒体会话、Core Audio、全屏感知和后台计时调度
- `assets/` 与 `src-tauri/icons/`：Atoll 品牌图形与 Windows 图标
- `PRODUCT.md`：长期产品约束
- `DESIGN.md`：视觉系统与组件规则
- `.impeccable/surfaces/`：当前主界面的 surface brief
- `artifacts/screenshots/`：实机验收截图

## 当前边界

- 第一版固定在主显示器顶部居中，尚未提供指定显示器、左/右对齐或尺寸调整 UI。
- 设置页尚未包含开机启动、托盘开关、模块开关、快捷键编辑和超时调整。
- 全屏时采用保守策略：计时器完成不会突破全屏隐藏。
- Windows 锁屏/解锁没有单独的会话事件监听；窗口由系统桌面隔离，计时器依靠墙钟时间在恢复后校正。
