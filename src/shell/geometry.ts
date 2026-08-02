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
  reef: { width: 96, height: 32, cornerRadius: 16 },
  compact: { width: 256, height: 56, cornerRadius: 28 },
  expanded: { width: 400, height: 176, cornerRadius: 28 },
};

export function shellGeometryStyle(state: Exclude<ShellState, "hidden">): string {
  return `style="--shell-radius:${SHELL_GEOMETRY[state].cornerRadius}px"`;
}
