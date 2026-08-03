import type { ShellState } from "../domain";

export interface WindowDimensions {
  width: number;
  height: number;
  cornerRadius: number;
}

// The host deliberately extends 12 DIP above the monitor. This makes Atoll
// feel anchored to the top edge while preserving a real lower silhouette and
// a single transparent native window region.
export const TOP_EDGE_HOST_BLEED = 12;
export const ISLAND_TOP_MARGIN = -TOP_EDGE_HOST_BLEED;

export const SHELL_GEOMETRY: Record<Exclude<ShellState, "hidden">, WindowDimensions> = {
  // Heights include the off-screen top bleed. The visible footprints remain
  // 96 × 32, 256 × 56, and 400 × 176 DIP respectively.
  //
  // A shared restrained corner follows the Windows Widgets card language. It
  // is intentionally not a capsule: the native region and CSS silhouette use
  // the same 12 DIP radius so material never escapes its edge.
  reef: { width: 96, height: 32 + TOP_EDGE_HOST_BLEED, cornerRadius: 12 },
  compact: { width: 256, height: 56 + TOP_EDGE_HOST_BLEED, cornerRadius: 12 },
  expanded: { width: 400, height: 176 + TOP_EDGE_HOST_BLEED, cornerRadius: 12 },
};

export function shellGeometryStyle(state: Exclude<ShellState, "hidden">): string {
  return `style="--shell-radius:${SHELL_GEOMETRY[state].cornerRadius}px"`;
}
