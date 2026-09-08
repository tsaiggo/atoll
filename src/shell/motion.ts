import { canonicalNotch, pathFor, roundedRect, type NotchEdge, type NotchGeometry, type Point, type SurfaceRect } from "./geometry.ts";
import { CODENOTCH as C } from "./codenotch.ts";

// NotchMotion.swift. Response is the undamped period, not the animation duration.
export const MOTION = {
  unfold: { response: .42, damping: .78 },
  contents: { response: .36, damping: .82 },
  glide: { response: .5, damping: .86 },
  reading: { response: .9, damping: .9 },
  crossfade: .16, stagger: .045, maxStagger: .18, merge: .2,
} as const;
export function spring(t: number, response: number, damping: number): number {
  if (t <= 0) return 0;
  const omega = 2 * Math.PI / response, beta = Math.sqrt(1-damping*damping);
  return 1-Math.exp(-damping*omega*t)*(Math.cos(omega*beta*t)+damping/beta*Math.sin(omega*beta*t));
}
export const mix = (a: number, b: number, t: number): number => a+(b-a)*t;
function mixRect(a: SurfaceRect, b: SurfaceRect, t: number): SurfaceRect {
  return { x: mix(a.x,b.x,t), y: mix(a.y,b.y,t), width: mix(a.width,b.width,t), height: mix(a.height,b.height,t) };
}
function railPoints(rail: SurfaceRect, edge: NotchEdge): Point[] {
  const vertical = edge === "left" || edge === "right";
  const depth = vertical ? rail.width : rail.height, length = vertical ? rail.height : rail.width;
  return canonicalNotch(depth,length).map(({x:u,y:v}) => {
    if (edge === "right") return {x:rail.x+u,y:rail.y+v};
    if (edge === "left") return {x:rail.x+depth-u,y:rail.y+v};
    if (edge === "top") return {x:rail.x+v,y:rail.y+depth-u};
    return {x:rail.x+v,y:rail.y+u};
  });
}
export function geometryFrame(from: NotchGeometry, to: NotchGeometry, edge: NotchEdge, t: number): NotchGeometry {
  if (t === 1) return to;
  const rail = mixRect(from.rail,to.rail,t);
  const panel = from.panel && to.panel ? mixRect(from.panel,to.panel,t) : to.panel ?? from.panel;
  const a=from.anchor??to.anchor,b=to.anchor??from.anchor;
  const anchor = a && b ? {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)} : null;
  const orb=to.orb??from.orb, railContour=railPoints(rail,edge);
  const contours=[railContour], regions=[{points:railContour}];
  if (orb) regions.push({points:roundedRect({x:orb.x-5,y:orb.y-5,width:orb.width+10,height:orb.height+10},C.orbHotZone/2)});
  if (panel && anchor) {
    const card=roundedRect(panel,C.cardCorner);
    const vertical=edge==="left"||edge==="right";
    const direction=edge==="left"||edge==="top"?1:-1;
    const tip={x:anchor.x+(vertical?direction*C.tailGap:0),y:anchor.y+(vertical?0:direction*C.tailGap)};
    const base=vertical?(edge==="left"?panel.x:panel.x+panel.width):(edge==="top"?panel.y:panel.y+panel.height);
    const tail=vertical
      ? [{x:base,y:anchor.y-C.tailHeight/2},tip,{x:base,y:anchor.y+C.tailHeight/2}]
      : [{x:anchor.x-C.tailHeight/2,y:base},tip,{x:anchor.x+C.tailHeight/2,y:base}];
    contours.push(card,tail);regions.push({points:card},{points:tail});
    const minX=Math.min(anchor.x,tip.x,base),minY=Math.min(anchor.y,tip.y,base);
    const corridor=vertical
      ? {x:minX,y:anchor.y-C.tailHeight/2,width:Math.abs(base-anchor.x)+1,height:C.tailHeight}
      : {x:anchor.x-C.tailHeight/2,y:minY,width:C.tailHeight,height:Math.abs(base-anchor.y)+1};
    regions.push({points:roundedRect(corridor,0)});
  }
  return {...to,rail,panel,orb,anchor,regions,path:contours.map(pathFor).join(" ")};
}

// Evaluate a CSS timing curve in time-space (invert its x component first).
export function timingCurve(t: number, x1: number, y1: number, x2: number, y2: number): number {
  const bezier=(u:number,a:number,b:number)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*b+u*u*u;
  let lo=0,hi=1;
  for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(bezier(mid,x1,x2)<t)lo=mid;else hi=mid;}
  return bezier((lo+hi)/2,y1,y2);
}
export function springTiming(response: number, damping: number): string {
  const samples=Array.from({length:61},(_,i)=>i===60?1:spring(i/60*response*1.65,response,damping));
  return `linear(${samples.map(n=>n.toFixed(5)).join(",")})`;
}
