export type UiLanguage = "en" | "zh-CN";

export interface AppCopy {
  readonly notch: {
    readonly media: string;
    readonly energy: string;
    readonly codex: string;
    readonly openSettings: string;
    readonly pin: string;
    readonly unpin: string;
    readonly pinned: string;
    readonly placement: string;
    readonly visibility: string;
    readonly automatic: string;
    readonly always: string;
    readonly hint: string;
    readonly edges: {
      readonly top: string;
      readonly bottom: string;
      readonly left: string;
      readonly right: string;
    };
  };
  readonly shell: {
    readonly quickControls: string;
    readonly openAtoll: string;
    readonly collapseAtoll: string;
    readonly expandAtoll: string;
    readonly openSettings: string;
    readonly backHome: string;
    readonly hide: string;
    readonly home: string;
    readonly tagline: string;
    readonly readyTitle: string;
    readonly readyDetail: string;
    readonly mediaPlaying: string;
  };
  readonly actions: {
    readonly play: string;
    readonly pause: string;
    readonly previous: string;
    readonly next: string;
    readonly working: (label: string) => string;
  };
  readonly media: {
    readonly currentControls: string;
    readonly controls: string;
    readonly openControlsFor: (title: string) => string;
    readonly players: (count: number) => string;
    readonly playerConnected: (count: number) => string;
    readonly supportedPlayers: string;
    readonly progress: string;
    readonly seek: string;
    readonly progressValue: (elapsed: string, duration: string) => string;
    readonly coverAlt: (title: string) => string;
    readonly noMedia: string;
    readonly waitingForSession: string;
    readonly checkingTitle: string;
    readonly checkingDetail: string;
    readonly metadataTitle: string;
    readonly metadataDetail: string;
    readonly unavailableTitle: string;
    readonly unavailableDetail: string;
    readonly idleTitle: string;
    readonly idleDetail: string;
    readonly pendingPrevious: string;
    readonly pendingNext: string;
    readonly pendingPause: string;
    readonly pendingPlay: string;
    readonly controlUnavailable: string;
    readonly seekUnavailable: string;
    readonly accessibleStatus: (
      title: string,
      artist: string | null,
      playback: string,
      expand: string,
    ) => string;
    readonly playing: string;
    readonly paused: string;
    readonly waiting: string;
    readonly sourceTitle: string;
    readonly sourceAutomatic: string;
    readonly sourcePinned: string;
    readonly chooseSource: string;
    readonly backToControls: string;
    readonly sourceChangeUnavailable: string;
  };
  readonly energy: {
    readonly periodRecorded: string;
    readonly peakRecorded: string;
    readonly recordedDays: string;
    readonly coverage: (days: number, partial: number) => string;
    readonly todayBatteryDischarge: (value: string, unit: string) => string;
    readonly todayBatteryDischargeTitle: string;
    readonly capacityUnavailable: string;
    readonly batteryDischargeOnly: string;
    readonly partialRecord: string;
    readonly trackingSince: (time: string) => string;
    readonly openHistory: string;
    readonly historyTitle: string;
    readonly historySubtitle: string;
    readonly historyToday: string;
    readonly historyNoRecord: string;
    readonly historyUnavailableDetail: string;
    readonly historyFirstDayDetail: string;
    readonly historyPartialLegend: string;
    readonly historyEntry: (date: string, value: string, unit: string, partial: boolean) => string;
    readonly historyMissingEntry: (date: string) => string;
  };
  readonly codex: {
    readonly title: string;
    readonly subtitle: string;
    readonly openUsage: string;
    readonly enableTitle: string;
    readonly enableDetail: string;
    readonly enable: string;
    readonly disable: string;
    readonly checkingTitle: string;
    readonly checkingDetail: string;
    readonly noWindowTitle: string;
    readonly noWindowDetail: string;
    readonly signedOutTitle: string;
    readonly signedOutDetail: string;
    readonly unsupportedAuthTitle: string;
    readonly unsupportedAuthDetail: string;
    readonly cliMissingTitle: string;
    readonly cliMissingDetail: string;
    readonly unavailableTitle: string;
    readonly unavailableDetail: string;
    readonly protocolErrorTitle: string;
    readonly protocolErrorDetail: string;
    readonly refresh: string;
    readonly refreshing: string;
    readonly usagePercent: (value: string) => string;
    readonly resetIn: (value: string) => string;
    readonly resetUnknown: string;
    readonly windowFallback: (minutes: number) => string;
    readonly secondarySummary: (label: string, usedPercent: string, reset: string) => string;
    readonly sourcePrivacy: string;
  };
  readonly settings: {
    readonly title: string;
    readonly subtitle: string;
    readonly language: string;
    readonly fullscreen: string;
    readonly fullscreenDetail: string;
  };
}

const EN: AppCopy = {
  notch: {
    media: "Media",
    energy: "Battery discharge",
    codex: "Codex",
    openSettings: "Open notch settings",
    pin: "Keep this panel open",
    unpin: "Unpin this panel",
    pinned: "Pinned",
    placement: "Screen edge",
    visibility: "Status rail",
    automatic: "On hover",
    always: "Always visible",
    hint: "Hover to reveal. Click the empty notch area to pin or unpin.",
    edges: { top: "Top", bottom: "Bottom", left: "Left", right: "Right" },
  },
  shell: {
    quickControls: "Atoll quick controls",
    openAtoll: "Open Atoll",
    collapseAtoll: "Collapse Atoll",
    expandAtoll: "Expand Atoll",
    openSettings: "Open settings",
    backHome: "Back to Atoll home",
    hide: "Hide",
    home: "Home",
    tagline: "Your status, surfaced.",
    readyTitle: "Atoll is ready",
    readyDetail: "Click to surface controls",
    mediaPlaying: "Media is playing",
  },
  actions: {
    play: "Play",
    pause: "Pause",
    previous: "Previous",
    next: "Next",
    working: (label) => `${label}, working`,
  },
  media: {
    currentControls: "Current media controls",
    controls: "Media controls",
    openControlsFor: (title) => `Open media controls for ${title}`,
    players: (count) => `${count} players`,
    playerConnected: (count) =>
      count === 1 ? "1 player connected" : `${count} players connected`,
    supportedPlayers: "QQ Music · Spotify · browsers",
    progress: "Playback progress",
    seek: "Seek playback",
    progressValue: (elapsed, duration) => `${elapsed} of ${duration}`,
    coverAlt: (title) => `Album artwork for ${title}`,
    noMedia: "No media",
    waitingForSession: "Waiting for a session",
    checkingTitle: "Checking Windows media…",
    checkingDetail: "Looking for connected players",
    metadataTitle: "Player connected",
    metadataDetail: "It isn’t sharing track details with Windows",
    unavailableTitle: "Media controls unavailable",
    unavailableDetail: "Atoll couldn’t reach Windows media sessions",
    idleTitle: "No active media",
    idleDetail: "Start playback in QQ Music or another player",
    pendingPrevious: "Going to previous track…",
    pendingNext: "Going to next track…",
    pendingPause: "Pausing…",
    pendingPlay: "Playing…",
    controlUnavailable: "Control unavailable",
    seekUnavailable: "Seeking isn’t available",
    accessibleStatus: (title, artist, playback, expand) =>
      `${title}${artist ? ` by ${artist}` : ""}, ${playback}. ${expand}`,
    playing: "playing",
    paused: "paused",
    waiting: "waiting for a session",
    sourceTitle: "Playback source",
    sourceAutomatic: "Automatic",
    sourcePinned: "Pinned",
    chooseSource: "Choose playback source",
    backToControls: "Back to media controls",
    sourceChangeUnavailable: "Couldn’t change playback source",
  },
  energy: {
    periodRecorded: "Recorded · 30 days",
    peakRecorded: "Peak daily record",
    recordedDays: "Days recorded",
    coverage: (days, partial) => `${days}/30${partial ? ` · ${partial} partial` : ""}`,
    todayBatteryDischarge: (value, unit) => `Today's battery discharge: ${value} ${unit}`,
    todayBatteryDischargeTitle: "Today's battery discharge",
    capacityUnavailable: "Battery capacity unavailable",
    batteryDischargeOnly: "Battery discharge only",
    partialRecord: "Partial record",
    trackingSince: (time) => `since ${time}`,
    openHistory: "View the last 30 days",
    historyTitle: "Battery discharge",
    historySubtitle: "Last 30 days",
    historyToday: "Today so far",
    historyNoRecord: "No record",
    historyUnavailableDetail: "Windows is not reporting battery capacity right now.",
    historyFirstDayDetail: "Completed days will appear here as Atoll records them.",
    historyPartialLegend: "Gap: no record · Dashed cap: partial",
    historyEntry: (date, value, unit, partial) =>
      `${date}: ${value} ${unit}${partial ? ", partial record" : ""}`,
    historyMissingEntry: (date) => `${date}: no record`,
  },
  codex: {
    title: "Codex",
    subtitle: "Local usage",
    openUsage: "Open Codex usage",
    enableTitle: "Use Codex usage in Atoll?",
    enableDetail: "Enable a local check of your usage windows and reset times.",
    enable: "Enable",
    disable: "Turn off",
    checkingTitle: "Checking Codex usage…",
    checkingDetail: "Reading the local Codex App Server.",
    noWindowTitle: "No Codex usage window",
    noWindowDetail: "Codex didn’t report a usage window you can display.",
    signedOutTitle: "Sign in to Codex",
    signedOutDetail: "Atoll can read usage after the local Codex CLI is signed in.",
    unsupportedAuthTitle: "This Codex sign-in isn’t supported",
    unsupportedAuthDetail: "Use a supported Codex account, then refresh.",
    cliMissingTitle: "Codex CLI not found",
    cliMissingDetail: "Install Codex, then enable usage here.",
    unavailableTitle: "Codex usage unavailable",
    unavailableDetail: "Try refreshing the local Codex connection.",
    protocolErrorTitle: "Codex needs an update",
    protocolErrorDetail: "The local Codex protocol couldn’t be read.",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    usagePercent: (value) => `${value}% used`,
    resetIn: (value) => `Resets in ${value}`,
    resetUnknown: "Reset time unavailable",
    windowFallback: (minutes) =>
      minutes % 60 === 0
        ? `${minutes / 60}-hour window`
        : `${minutes}-minute window`,
    secondarySummary: (label, usedPercent, reset) =>
      `${label} · ${usedPercent}% used · ${reset}`,
    sourcePrivacy: "Local App Server only · no prompts, files, account IDs, or API keys",
  },
  settings: {
    title: "Settings",
    subtitle: "Placement and visibility",
    language: "Language",
    fullscreen: "In full screen",
    fullscreenDetail: "Hide Atoll automatically",
  },
};

const ZH_CN: AppCopy = {
  notch: {
    media: "媒体",
    energy: "电池放电",
    codex: "Codex",
    openSettings: "打开刘海设置",
    pin: "保持面板展开",
    unpin: "取消固定面板",
    pinned: "已固定",
    placement: "屏幕边缘",
    visibility: "状态栏",
    automatic: "悬停显示",
    always: "始终显示",
    hint: "悬停展开，点击边栏空白处可固定或取消固定。",
    edges: { top: "顶部", bottom: "底部", left: "左侧", right: "右侧" },
  },
  shell: {
    quickControls: "Atoll 快捷控制",
    openAtoll: "打开 Atoll",
    collapseAtoll: "收起 Atoll",
    expandAtoll: "展开 Atoll",
    openSettings: "打开设置",
    backHome: "返回 Atoll 首页",
    hide: "隐藏",
    home: "首页",
    tagline: "重要状态，浮现于顶端。",
    readyTitle: "Atoll 已就绪",
    readyDetail: "点击查看快捷控制",
    mediaPlaying: "正在播放媒体",
  },
  actions: {
    play: "播放",
    pause: "暂停",
    previous: "上一首",
    next: "下一首",
    working: (label) => `${label}，处理中`,
  },
  media: {
    currentControls: "当前媒体控制",
    controls: "媒体控制",
    openControlsFor: (title) => `打开《${title}》的媒体控制`,
    players: (count) => `${count} 个播放器`,
    playerConnected: (count) => `已连接 ${count} 个播放器`,
    supportedPlayers: "QQ 音乐 · Spotify · 浏览器",
    progress: "播放进度",
    seek: "调整播放进度",
    progressValue: (elapsed, duration) => `${elapsed} / ${duration}`,
    coverAlt: (title) => `《${title}》的专辑封面`,
    noMedia: "没有媒体",
    waitingForSession: "正在等待播放器",
    checkingTitle: "正在检查 Windows 媒体…",
    checkingDetail: "正在查找已连接的播放器",
    metadataTitle: "播放器已连接",
    metadataDetail: "播放器没有向 Windows 提供曲目信息",
    unavailableTitle: "媒体控制不可用",
    unavailableDetail: "Atoll 无法访问 Windows 媒体会话",
    idleTitle: "没有正在播放的媒体",
    idleDetail: "请在 QQ 音乐或其他播放器中开始播放",
    pendingPrevious: "正在切换到上一首…",
    pendingNext: "正在切换到下一首…",
    pendingPause: "正在暂停…",
    pendingPlay: "正在播放…",
    controlUnavailable: "当前控制不可用",
    seekUnavailable: "当前播放器不支持定位",
    accessibleStatus: (title, artist, playback, expand) =>
      `${title}${artist ? `，${artist}` : ""}，${playback}。${expand}`,
    playing: "正在播放",
    paused: "已暂停",
    waiting: "正在等待播放器",
    sourceTitle: "播放来源",
    sourceAutomatic: "自动",
    sourcePinned: "已固定",
    chooseSource: "选择播放来源",
    backToControls: "返回媒体控制",
    sourceChangeUnavailable: "无法切换播放来源",
  },
  energy: {
    periodRecorded: "近 30 天已记录",
    peakRecorded: "已记录单日峰值",
    recordedDays: "有记录天数",
    coverage: (days, partial) => `${days}/30${partial ? ` · ${partial} 天不完整` : ""}`,
    todayBatteryDischarge: (value, unit) => `今日电池放电：${value} ${unit}`,
    todayBatteryDischargeTitle: "今日电池放电",
    capacityUnavailable: "电池容量不可用",
    batteryDischargeOnly: "仅电池放电",
    partialRecord: "部分记录",
    trackingSince: (time) => `自 ${time} 开始记录`,
    openHistory: "查看近 30 天",
    historyTitle: "电池放电",
    historySubtitle: "近 30 天",
    historyToday: "今日累计",
    historyNoRecord: "暂无记录",
    historyUnavailableDetail: "Windows 当前未提供电池容量。",
    historyFirstDayDetail: "Atoll 记录到完整日期后会显示在这里。",
    historyPartialLegend: "缺口：未记录 · 虚线：部分记录",
    historyEntry: (date, value, unit, partial) =>
      `${date}：${value} ${unit}${partial ? "，部分记录" : ""}`,
    historyMissingEntry: (date) => `${date}：暂无记录`,
  },
  codex: {
    title: "Codex",
    subtitle: "本机用量",
    openUsage: "打开 Codex 用量",
    enableTitle: "要在 Atoll 中使用 Codex 用量吗？",
    enableDetail: "启用后，Atoll 会在本机读取用量窗口与重置时间。",
    enable: "启用",
    disable: "关闭",
    checkingTitle: "正在读取 Codex 用量…",
    checkingDetail: "正在读取本机 Codex App Server。",
    noWindowTitle: "没有可显示的 Codex 用量窗口",
    noWindowDetail: "Codex 未返回可供显示的用量窗口。",
    signedOutTitle: "请先登录 Codex",
    signedOutDetail: "本机 Codex CLI 登录后，Atoll 才能读取用量。",
    unsupportedAuthTitle: "当前 Codex 登录方式暂不支持",
    unsupportedAuthDetail: "请使用受支持的 Codex 账户后刷新。",
    cliMissingTitle: "未找到 Codex CLI",
    cliMissingDetail: "安装 Codex 后，再在这里启用用量显示。",
    unavailableTitle: "Codex 用量暂不可用",
    unavailableDetail: "请刷新本机 Codex 连接后重试。",
    protocolErrorTitle: "Codex 需要更新",
    protocolErrorDetail: "无法读取本机 Codex 协议。",
    refresh: "刷新",
    refreshing: "正在刷新…",
    usagePercent: (value) => `已用 ${value}%`,
    resetIn: (value) => `${value}后重置`,
    resetUnknown: "重置时间暂不可用",
    windowFallback: (minutes) => `${minutes} 分钟窗口`,
    secondarySummary: (label, usedPercent, reset) => `${label} · 已用 ${usedPercent}% · ${reset}`,
    sourcePrivacy: "仅本机 App Server · 不读取提示词、文件、账户 ID 或 API 密钥",
  },
  settings: {
    title: "设置",
    subtitle: "停靠与显示",
    language: "语言",
    fullscreen: "全屏时",
    fullscreenDetail: "自动隐藏 Atoll",
  },
};

const COPY: Record<UiLanguage, AppCopy> = {
  en: EN,
  "zh-CN": ZH_CN,
};

export function copyFor(language: UiLanguage): AppCopy {
  return COPY[language];
}

export function normalizeLanguage(value: unknown): UiLanguage {
  return value === "zh-CN" ? "zh-CN" : "en";
}
