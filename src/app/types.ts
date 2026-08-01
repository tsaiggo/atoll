import type { AtollSettings } from "../config";
import type {
  ContentKind,
  MediaConnection,
  MediaStatus,
  ShellState,
  VolumeStatus,
} from "../domain";
import type { MediaCommand, MediaCommandFeedback } from "../features/media/commands";

export type ExpandedPanel = "home" | "media" | "settings";

export type PreviewMode =
  | "reef"
  | "compact-media"
  | "expanded-home"
  | "expanded-media"
  | "settings";

export interface AppViewModel {
  readonly shell: ShellState;
  readonly content: ContentKind;
  readonly expandedPanel: ExpandedPanel;
  readonly media: MediaStatus | null;
  readonly mediaConnection: MediaConnection;
  readonly volume: VolumeStatus;
  readonly settings: AtollSettings;
  readonly pendingMediaCommand: MediaCommand | null;
  readonly mediaCommandFeedback: MediaCommandFeedback | null;
  readonly showInlineVolume: boolean;
  readonly animateContent: boolean;
  readonly motionDisabled: boolean;
  readonly now: number;
}
