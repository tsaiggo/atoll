export type UiLanguage = "en" | "zh-CN";

export interface AppCopy {
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
  readonly volume: {
    readonly title: string;
    readonly muted: string;
    readonly controls: string;
    readonly mute: string;
    readonly unmute: string;
    readonly percent: (value: number) => string;
    readonly accessibleValue: (value: number, muted: boolean) => string;
  };
  readonly energy: {
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
  readonly settings: {
    readonly title: string;
    readonly subtitle: string;
    readonly language: string;
    readonly fullscreen: string;
    readonly fullscreenDetail: string;
  };
}

const EN: AppCopy = {
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
  volume: {
    title: "Volume",
    muted: "Muted",
    controls: "System volume controls",
    mute: "Mute system volume",
    unmute: "Unmute system volume",
    percent: (value) => `${value} percent`,
    accessibleValue: (value, muted) =>
      muted ? `Muted, ${value} percent` : `${value} percent`,
  },
  energy: {
    todayBatteryDischarge: (value, unit) => `Today's battery discharge: ${value} ${unit}`,
    todayBatteryDischargeTitle: "Today's battery discharge",
    capacityUnavailable: "Battery capacity unavailable",
    batteryDischargeOnly: "Battery discharge only",
    partialRecord: "Partial record",
    trackingSince: (time) => `since ${time}`,
    openHistory: "View the last 7 days",
    historyTitle: "Battery discharge",
    historySubtitle: "Last 7 days",
    historyToday: "Today so far",
    historyNoRecord: "No record",
    historyUnavailableDetail: "Windows is not reporting battery capacity right now.",
    historyFirstDayDetail: "Completed days will appear here as Atoll records them.",
    historyPartialLegend: "Dashed cap = partial record",
    historyEntry: (date, value, unit, partial) =>
      `${date}: ${value} ${unit}${partial ? ", partial record" : ""}`,
    historyMissingEntry: (date) => `${date}: no record`,
  },
  settings: {
    title: "Settings",
    subtitle: "Theme and motion follow Windows",
    language: "Language",
    fullscreen: "In full screen",
    fullscreenDetail: "Hide Atoll automatically",
  },
};

const ZH_CN: AppCopy = {
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
  volume: {
    title: "音量",
    muted: "已静音",
    controls: "系统音量控制",
    mute: "静音系统音量",
    unmute: "恢复系统音量",
    percent: (value) => `${value}%`,
    accessibleValue: (value, muted) =>
      muted ? `已静音，音量 ${value}%` : `音量 ${value}%`,
  },
  energy: {
    todayBatteryDischarge: (value, unit) => `今日电池放电：${value} ${unit}`,
    todayBatteryDischargeTitle: "今日电池放电",
    capacityUnavailable: "电池容量不可用",
    batteryDischargeOnly: "仅电池放电",
    partialRecord: "部分记录",
    trackingSince: (time) => `自 ${time} 开始记录`,
    openHistory: "查看近 7 天",
    historyTitle: "电池放电",
    historySubtitle: "近 7 天",
    historyToday: "今日累计",
    historyNoRecord: "暂无记录",
    historyUnavailableDetail: "Windows 当前未提供电池容量。",
    historyFirstDayDetail: "Atoll 记录到完整日期后会显示在这里。",
    historyPartialLegend: "虚线顶端表示部分记录",
    historyEntry: (date, value, unit, partial) =>
      `${date}：${value} ${unit}${partial ? "，部分记录" : ""}`,
    historyMissingEntry: (date) => `${date}：暂无记录`,
  },
  settings: {
    title: "设置",
    subtitle: "主题和动效跟随 Windows",
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
