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
    readonly remaining: (value: string) => string;
  };
  readonly actions: {
    readonly play: string;
    readonly pause: string;
    readonly previous: string;
    readonly next: string;
    readonly continue: string;
    readonly restart: string;
    readonly cancel: string;
    readonly stop: string;
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
    readonly accessibleStatus: (
      title: string,
      artist: string | null,
      playback: string,
      expand: string,
    ) => string;
    readonly playing: string;
    readonly paused: string;
    readonly waiting: string;
  };
  readonly volume: {
    readonly title: string;
    readonly muted: string;
    readonly percent: (value: number) => string;
    readonly accessibleValue: (value: number, muted: boolean) => string;
  };
  readonly timer: {
    readonly start: string;
    readonly presets: string;
    readonly minutes: (value: number) => string;
    readonly focus: string;
    readonly paused: string;
    readonly inProgress: string;
    readonly focusPaused: string;
    readonly focusTimer: string;
    readonly running: string;
    readonly accurateTime: string;
    readonly timesUp: string;
    readonly complete: string;
    readonly completionMessage: string;
    readonly remaining: (value: string) => string;
    readonly accessibleRunning: (value: string, suffix: string) => string;
    readonly accessiblePaused: (value: string, expand: string) => string;
    readonly accessibleComplete: (expand: string) => string;
  };
  readonly carousel: {
    readonly position: (position: number, count: number) => string;
  };
  readonly settings: {
    readonly title: string;
    readonly subtitle: string;
    readonly language: string;
    readonly fullscreen: string;
    readonly fullscreenDetail: string;
    readonly idle: string;
    readonly idleDetail: string;
    readonly reef: string;
    readonly hidden: string;
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
    remaining: (value) => `${value} remaining`,
  },
  actions: {
    play: "Play",
    pause: "Pause",
    previous: "Previous",
    next: "Next",
    continue: "Continue",
    restart: "Restart",
    cancel: "Cancel",
    stop: "Stop",
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
    accessibleStatus: (title, artist, playback, expand) =>
      `${title}${artist ? ` by ${artist}` : ""}, ${playback}. ${expand}`,
    playing: "playing",
    paused: "paused",
    waiting: "waiting for a session",
  },
  volume: {
    title: "Volume",
    muted: "Muted",
    percent: (value) => `${value} percent`,
    accessibleValue: (value, muted) =>
      muted ? `Muted, ${value} percent` : `${value} percent`,
  },
  timer: {
    start: "Start a focus timer",
    presets: "Timer presets",
    minutes: (value) => `${value} min`,
    focus: "Focus",
    paused: "Paused",
    inProgress: "In progress",
    focusPaused: "Focus paused",
    focusTimer: "Focus timer",
    running: "Running",
    accurateTime: "Ends from real elapsed time",
    timesUp: "Time’s up",
    complete: "Focus session complete",
    completionMessage: "Your session is complete. Take a breath before the next one.",
    remaining: (value) => `${value} remaining`,
    accessibleRunning: (value, suffix) =>
      `Focus timer, ${value} remaining, running. Expand Atoll${suffix}`,
    accessiblePaused: (value, expand) =>
      `Focus timer, ${value} remaining, paused. ${expand}`,
    accessibleComplete: (expand) => `Focus timer complete. ${expand}`,
  },
  carousel: {
    position: (position, count) =>
      `. Card ${position} of ${count}. Use the mouse wheel or arrow keys to switch`,
  },
  settings: {
    title: "Settings",
    subtitle: "Theme and motion follow Windows",
    language: "Language",
    fullscreen: "In full screen",
    fullscreenDetail: "Hide Atoll automatically",
    idle: "When idle",
    idleDetail: "Choose the resting state",
    reef: "Reef",
    hidden: "Hidden",
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
    remaining: (value) => `剩余 ${value}`,
  },
  actions: {
    play: "播放",
    pause: "暂停",
    previous: "上一首",
    next: "下一首",
    continue: "继续",
    restart: "重新开始",
    cancel: "取消",
    stop: "结束",
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
    accessibleStatus: (title, artist, playback, expand) =>
      `${title}${artist ? `，${artist}` : ""}，${playback}。${expand}`,
    playing: "正在播放",
    paused: "已暂停",
    waiting: "正在等待播放器",
  },
  volume: {
    title: "音量",
    muted: "已静音",
    percent: (value) => `${value}%`,
    accessibleValue: (value, muted) =>
      muted ? `已静音，音量 ${value}%` : `音量 ${value}%`,
  },
  timer: {
    start: "开始专注计时",
    presets: "计时预设",
    minutes: (value) => `${value} 分钟`,
    focus: "专注",
    paused: "已暂停",
    inProgress: "进行中",
    focusPaused: "专注已暂停",
    focusTimer: "专注计时",
    running: "计时中",
    accurateTime: "按真实经过时间计算",
    timesUp: "时间到",
    complete: "本次专注已完成",
    completionMessage: "本次专注已经完成，休息一下再继续。",
    remaining: (value) => `剩余 ${value}`,
    accessibleRunning: (value, suffix) =>
      `专注计时，剩余 ${value}，进行中。展开 Atoll${suffix}`,
    accessiblePaused: (value, expand) => `专注计时，剩余 ${value}，已暂停。${expand}`,
    accessibleComplete: (expand) => `专注计时已完成。${expand}`,
  },
  carousel: {
    position: (position, count) =>
      `。第 ${position} 张，共 ${count} 张。可使用鼠标滚轮或方向键切换`,
  },
  settings: {
    title: "设置",
    subtitle: "主题和动效跟随 Windows",
    language: "语言",
    fullscreen: "全屏时",
    fullscreenDetail: "自动隐藏 Atoll",
    idle: "空闲时",
    idleDetail: "选择常驻状态",
    reef: "礁脊",
    hidden: "隐藏",
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
