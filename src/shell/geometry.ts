import type { ShellState } from "../domain";

export interface WindowDimensions {
  width: number;
  height: number;
  cornerRadius: number;
}

export const SHELL_GEOMETRY: Record<Exclude<ShellState, "hidden">, WindowDimensions> = {
  reef: { width: 80, height: 12, cornerRadius: 12 },
  compact: { width: 188, height: 44, cornerRadius: 22 },
  expanded: { width: 384, height: 148, cornerRadius: 12 },
};

export function shellGeometryStyle(state: Exclude<ShellState, "hidden">): string {
  return `style="--shell-bottom-radius:${SHELL_GEOMETRY[state].cornerRadius}px"`;
}
