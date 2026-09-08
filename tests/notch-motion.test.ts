import assert from "node:assert/strict";
import test from "node:test";
import { notchGeometry } from "../src/shell/geometry.ts";
import { geometryFrame, spring, MOTION } from "../src/shell/motion.ts";

test("a source spring settles with one restrained overshoot rather than an ease",()=>{
  for (const spec of [MOTION.unfold,MOTION.contents,MOTION.glide,MOTION.reading]) {
    assert.equal(spring(0,spec.response,spec.damping),0);
    const values=Array.from({length:200},(_,i)=>spring(i*spec.response/100,spec.response,spec.damping));
    assert.ok(Math.max(...values)>1);
    assert.ok(Math.max(...values)<1.025);
    assert.ok(Math.abs(values.at(-1)-1)<.001);
  }
});

test("all fold and tooltip animation frames fit the native region contract",()=>{
  for(const edge of ["top","right","bottom","left"]) {
    const states=[notchGeometry("reef",edge),notchGeometry("compact",edge),notchGeometry("expanded",edge,"media"),notchGeometry("expanded",edge,"settings"),notchGeometry("expanded",edge,"codex")];
    for (const from of states)for(const to of states) {
      assert.equal(from.width,to.width);assert.equal(from.height,to.height);
      for(let i=0;i<=40;i++) {
        const t=i===40?1:spring(i*.02,.42,.78),g=geometryFrame(from,to,edge,t);
        assert.ok(g.regions.length<=6);
        for(const r of g.regions){
          assert.ok(r.points.length<=64);
          for(const p of r.points)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.001&&p.y>=-.001&&p.x<=g.width+.001&&p.y<=g.height+.001,`${edge} frame ${i}`);
        }
      }
      assert.deepEqual(geometryFrame(from,to,edge,1),to);
    }
  }
});
