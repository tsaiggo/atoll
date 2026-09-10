import type { AtollSettings } from "../config";
import type {
  CodexUsageStatus,
  ContentKind,
  EnergyStatus,
  MediaConnection,
  MediaStatus,
  ShellState,
} from "../domain";
import type { MediaCommand, MediaCommandFeedback } from "../features/media/commands";

export type ExpandedPanel = "home" | "media" | "energy" | "codex" | "settings" | "sources";

export type PreviewMode =
  | "reef"
  | "compact-media"
  | "expanded-home"
  | "expanded-media"
  | "expanded-energy"
  | "expanded-codex"
  | "expanded-sources"
  | "settings";

export interface AppViewModel {
  readonly shell: ShellState;
  readonly notchPinned?: boolean;
  readonly content: ContentKind;
  readonly expandedPanel: ExpandedPanel;
  readonly media: MediaStatus | null;
  readonly mediaConnection: MediaConnection;
  readonly energy: EnergyStatus;
  readonly codexUsage: CodexUsageStatus;
  readonly selectedEnergyDayKey: string | null;
  readonly settings: AtollSettings;
  readonly pendingMediaCommand: MediaCommand | null;
  readonly pendingMediaSeek: boolean;
  readonly pendingSourceSelection: boolean;
  readonly pendingCodexUsageAction: "enable" | "disable" | "refresh" | null;
  readonly mediaCommandFeedback: MediaCommandFeedback | null;
  readonly animateContent: boolean;
  readonly motionDisabled: boolean;
  readonly now: number;
}
