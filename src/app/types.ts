import type { AtollSettings } from "../config";
import type {
  ContentKind,
  MediaConnection,
  MediaStatus,
  ShellState,
  TimerStatus,
  VolumeStatus,
} from "../domain";
import type { MediaCommand, MediaCommandFeedback } from "../features/media/commands";
import type {
  CarouselCardKind,
  CarouselDirection,
} from "../features/surface/carousel";

export type ExpandedPanel = "home" | "media" | "timer" | "settings" | "timer-finished";

export type PreviewMode =
  | "reef"
  | "compact-media"
  | "compact-carousel"
  | "expanded-media"
  | "timer-finished";

export interface AppViewModel {
  readonly shell: ShellState;
  readonly content: ContentKind;
  readonly expandedPanel: ExpandedPanel;
  readonly media: MediaStatus | null;
  readonly mediaConnection: MediaConnection;
  readonly volume: VolumeStatus;
  readonly timer: TimerStatus;
  readonly settings: AtollSettings;
  readonly pendingMediaCommand: MediaCommand | null;
  readonly mediaCommandFeedback: MediaCommandFeedback | null;
  readonly carouselCards: readonly CarouselCardKind[];
  readonly carouselActiveCard: CarouselCardKind | null;
  readonly carouselMotion: CarouselDirection | null;
  readonly showInlineVolume: boolean;
  readonly animateContent: boolean;
  readonly motionDisabled: boolean;
  readonly now: number;
}
