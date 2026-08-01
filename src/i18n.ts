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
