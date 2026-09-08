import type { ShellState } from "../domain";
import { CODENOTCH as C, notchMetrics } from "./codenotch.ts";

export type NotchEdge = "top" | "bottom" | "left" | "right";
export interface Point { x: number; y: number }
export interface SurfaceRect { x: number; y: number; width: number; height: number }
export interface WindowDimensions { width: number; height: number; cornerRadius: number }
export interface NotchRegion { points: Point[] }
export interface NotchGeometry extends WindowDimensions {
  rail: SurfaceRect; panel: SurfaceRect | null; orb: SurfaceRect | null;
  regions: NotchRegion[]; path: string; anchor: Point | null;
}
export const TOP_EDGE_HOST_BLEED = 0;
export const ISLAND_TOP_MARGIN = 0;
export function isNotchEdge(value: unknown): value is NotchEdge {
  return value === "top" || value === "bottom" || value === "left" || value === "right";
}
function arc(points: Point[], cx: number, cy: number, r: number, from: number, to: number): void {
  for (let i = 0; i <= 12; i++) {
    const a = (from + (to-from)*i/12)*Math.PI/180;
    points.push({ x: cx+Math.cos(a)*r, y: cy+Math.sin(a)*r });
  }
}
export function roundedRect({x,y,width:w,height:h}: SurfaceRect, radius: number): Point[] {
  const r = Math.min(radius,w/2,h/2), p: Point[] = [];
  arc(p,x+w-r,y+r,r,-90,0); arc(p,x+w-r,y+h-r,r,0,90);
  arc(p,x+r,y+h-r,r,90,180); arc(p,x+r,y+r,r,180,270);
  return p;
}
// Direct port of SideNotchShape.canonicalPath. Corner claims depth first,
// leaving the rest for the inverse curl even in the folded pill.
// 12 segments per quarter circle keep each Win32 region below 64 points.
export function canonicalNotch(depth: number, length: number): Point[] {
  const wanted = Math.max(0,Math.min(C.corner,depth/2));
  const curl = Math.max(0,Math.min(C.curl,length/2,depth-wanted));
  const corner = Math.max(0,Math.min(wanted,(length-2*curl)/2));
  const p: Point[] = [];
  arc(p,depth-curl,0,curl,0,90);
  arc(p,corner,curl+corner,corner,270,180);
  arc(p,corner,length-curl-corner,corner,180,90);
  arc(p,depth-curl,length,curl,270,360);
  return p;
}
export function pathFor(points: Point[]): string {
  const area = points.reduce((sum,p,i)=>{ const n=points[(i+1)%points.length]; return sum+p.x*n.y-n.x*p.y; },0);
  const contour = area < 0 ? [...points].reverse() : points;
  return contour.map((p,i)=>`${i?"L":"M"}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ")+" Z";
}
export function notchGeometry(state: Exclude<ShellState,"hidden">, edge: NotchEdge="top", panelKey="home"): NotchGeometry {
  const vertical = edge === "left" || edge === "right";
  const folded = state === "reef", expanded = state === "expanded", m=notchMetrics(vertical);
  const depth=folded?C.pillDepth:m.depth, length=folded?C.pillLength:m.length;
  const panelWidth=panelKey==="settings"?360:panelKey==="sources"||panelKey==="home"?300:C.cardWidth;
  const panelHeight=panelKey==="settings"?320:panelKey==="volume"?120:panelKey==="media"||panelKey==="codex"?176:panelKey==="energy"?224:210;
  // Symmetric slack keeps the rail still across all detail changes. Only the
  // actual contours intercept desktop clicks inside the transparent host.
  const slack=vertical?88:208, hostAlong=m.length+2*slack;
  const hostAcross=m.depth+C.tailGap+C.tailLength+(vertical?360:320)+8;
  const leading=slack+(m.length-length)/2;
  const width=vertical?hostAcross:hostAlong, height=vertical?hostAlong:hostAcross;
  const point=(along:number,across:number):Point=>{
    if(edge==="top")return{x:along,y:across};
    if(edge==="bottom")return{x:along,y:height-across};
    if(edge==="left")return{x:across,y:along};
    return{x:width-across,y:along};
  };
  const rect=(along:number,across:number,len:number,dep:number):SurfaceRect=>{
    const a=point(along,across),b=point(along+len,across+dep);
    return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};
  };
  const rail=rect(leading,0,length,depth);
  const contours=[canonicalNotch(depth,length).map(p=>point(p.y+leading,depth-p.x))];
  const regions:NotchRegion[]=contours.map(points=>({points}));
  if(folded){
    // The source wakes the small pill from a band extending inward by 90
    // design pixels. This is an intentional hover target, not painted chrome.
    regions.push({points:roundedRect(rect(leading,0,length,depth+C.pillHotZone),0)});
    return{width,height,cornerRadius:C.pillDepth/2,rail,orb:null,panel:null,anchor:null,regions,path:pathFor(contours[0])};
  }
  const orb=rect(slack+length-C.orb/2,C.curl-C.orb/2,C.orb,C.orb);
  const hot=rect(slack+length-C.orbHotZone/2,Math.max(0,C.curl-C.orbHotZone/2),C.orbHotZone,C.orbHotZone);
  regions.push({points:roundedRect(hot,C.orbHotZone/2)});
  let panel:SurfaceRect|null=null,anchor:Point|null=null;
  if(expanded){
    const index=panelKey==="media"||panelKey==="sources"?0:panelKey==="volume"?1:panelKey==="energy"?2:3;
    const along=slack+(panelKey==="settings"?length-C.curl:m.centers[index]);
    const panelAlong=vertical?panelHeight:panelWidth, panelAcross=vertical?panelWidth:panelHeight;
    const start=Math.min(hostAlong-panelAlong-16,Math.max(16,along-panelAlong/2));
    panel=rect(start,depth+C.tailGap+C.tailLength,panelAlong,panelAcross);
    anchor=point(along,depth);
    const card=roundedRect(panel,C.cardCorner);
    contours.push(card);regions.push({points:card});
    const tail=[point(along-C.tailHeight/2,depth+C.tailGap+C.tailLength+0.25),point(along,depth+C.tailGap),point(along+C.tailHeight/2,depth+C.tailGap+C.tailLength+0.25)];
    contours.push(tail);regions.push({points:tail});
    regions.push({points:roundedRect(rect(along-C.tailHeight/2,depth-1,C.tailHeight,C.tailGap+C.tailLength+2),0)});
  }
  return{width,height,cornerRadius:C.cardCorner,rail,panel,orb,anchor,regions,path:contours.map(pathFor).join(" ")};
}
export const SHELL_GEOMETRY:Record<Exclude<ShellState,"hidden">,WindowDimensions>={
  reef:notchGeometry("reef"),compact:notchGeometry("compact"),expanded:notchGeometry("expanded"),
};
export function shellGeometryStyle(state:Exclude<ShellState,"hidden">):string{
  return `style="--shell-radius:${SHELL_GEOMETRY[state].cornerRadius}px"`;
}
