import type { ShellState } from "../domain";

export interface WindowDimensions {
  width: number;
  height: number;
  cornerRadius: number;
}

// A visible top inset is part of the Island contract: every state owns four
// real corners, rather than borrowing the monitor edge as two of them.
export const ISLAND_TOP_MARGIN = 8;

export const SHELL_GEOMETRY: Record<Exclude<ShellState, "hidden">, WindowDimensions> = {
  // Graded corners: short surfaces (reef, compact) sit close to a capsule so
  // they read soft, while the tall 400 × 176 expanded surface stays a rounded
  // card, not a pill. The native region and CSS silhouette must use these exact
  // values so the material never escapes the styled radius.
  reef: { width: 96, height: 32, cornerRadius: 16 },
  compact: { width: 256, height: 56, cornerRadius: 20 },
  expanded: { width: 400, height: 176, cornerRadius: 16 },
};

export function shellGeometryStyle(state: Exclude<ShellState, "hidden">): string {
  return `style="--shell-radius:${SHELL_GEOMETRY[state].cornerRadius}px"`;
}
