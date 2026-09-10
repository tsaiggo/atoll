import assert from "node:assert/strict";
import test from "node:test";
import { notchGeometry, isNotchEdge, canonicalNotch } from "../src/shell/geometry.ts";
import { CODENOTCH as C, notchMetrics } from "../src/shell/codenotch.ts";
const edges=["top","bottom","left","right"];
function inside(p, polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }
  return result;
}
const hits=(g,p)=>g.regions.some(r=>inside(p,r.points));
const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
const near=(a,b)=>assert.ok(Math.abs(a-b)<0.001,`${a} versus ${b}`);
const inward=(p,edge,d)=>({x:p.x+(edge==="left"?d:edge==="right"?-d:0),y:p.y+(edge==="top"?d:edge==="bottom"?-d:0)});

test("every state, edge and detail fits the native polygon contract",()=>{
  for(const edge of edges)for(const state of ["reef","compact","expanded"])for(const panel of ["media","energy","codex","settings","sources","home"]){
    const g=notchGeometry(state,edge,panel);
    assert.ok(g.regions.length<=6);
    for(const r of g.regions){
      assert.ok(r.points.length>=3 && r.points.length<=64);
      for(const p of r.points){
        assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
        assert.ok(p.x>=-0.001&&p.x<=g.width+0.001&&p.y>=-0.001&&p.y<=g.height+0.001,edge+state+panel);
      }
    }
    assert.ok(hits(g,center(g.rail)));
    if(g.panel)assert.ok(hits(g,center(g.panel)));
    if(g.orb)assert.ok(hits(g,center(g.orb)));
  }
});
test("source measurements retain the distinct vertical and horizontal pitches",()=>{
  const v=notchMetrics(true),h=notchMetrics(false),px=44/117;
  near(v.depth,186*px);
  near(v.pitch,44+26.9*px+17+83.5*px);
  near(h.pitch,44+83.5*px);
  near(h.depth,186*px+26.9*px+17);
  near(v.centers[0],103*px+69.5*px+22);
  near(h.centers[0],103*px+(69.5+50.1)*px/2+22);
});
test("inverse shoulders are circular arcs with the source radius",()=>{
  const p=canonicalNotch(C.sideDepth,notchMetrics(true).length);
  for(const q of p.slice(0,13))near(Math.hypot(q.x-(C.sideDepth-C.curl),q.y),C.curl);
  const folded=canonicalNotch(C.pillDepth,C.pillLength);
  assert.ok(folded.some(p=>p.x<0.001));
  near(folded[0].x,C.pillDepth);
});
test("detail changes preserve the rail in screen coordinates",()=>{
  for(const edge of edges){
    const screen=g=>{
      const r=center(g.rail);
      if(edge==="top")return{x:960-g.width/2+r.x,y:r.y};
      if(edge==="bottom")return{x:960-g.width/2+r.x,y:1040-g.height+r.y};
      if(edge==="left")return{x:r.x,y:520-g.height/2+r.y};
      return{x:1920-g.width+r.x,y:520-g.height/2+r.y};
    };
    const base=screen(notchGeometry("compact",edge));
    for(const panel of ["media","codex","settings"]){
      const p=screen(notchGeometry("expanded",edge,panel));near(p.x,base.x);near(p.y,base.y);
    }
  }
});
test("paint leaves the tail gap clear while a narrow native corridor joins the card",()=>{
  for(const edge of edges)for(const panel of ["media","energy","codex"]){
    const g=notchGeometry("expanded",edge,panel);
    const paths=g.path.split(" Z").filter(p=>p.trim()).map(path=>[...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m=>({x:+m[1],y:+m[2]})));
    for(let d=1;d<C.tailGap+C.tailLength+1;d++)assert.ok(hits(g,inward(g.anchor,edge,d)),edge+panel+d);
    const clear=inward(g.anchor,edge,C.tailGap/2);
    assert.ok(!paths.some(p=>inside(clear,p)));
    const seam=inward(g.anchor,edge,C.tailGap+C.tailLength+0.1);
    assert.ok(paths.some(p=>inside(seam,p)));
    const outside={x:1,y:1};
    assert.equal(hits(g,outside),false);
    near(g.panel.width,C.cardWidth);
  }
});
test("only the four supported edges are accepted",()=>{
  for(const edge of edges)assert.equal(isNotchEdge(edge),true);
  for(const value of ["TOP","diagonal","",null,12,{}])assert.equal(isNotchEdge(value),false);
});
