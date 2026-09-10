import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ATOLL_PLAYWRIGHT_MODULE || "playwright");
const browser=await chromium.connectOverCDP("http://127.0.0.1:9238");
const page=browser.contexts()[0].pages()[0];
assert.ok(page,"Atoll WebView exists");
assert.ok(!page.url().includes(":1420"),"native smoke must not load the other project");
await page.waitForSelector("#app[data-shell]:not([data-shell=hidden])");
await page.evaluate(()=>document.querySelector(".reef")?.click());
await page.waitForSelector("[data-notch-panel=settings]");
await page.locator("[data-notch-panel=settings]").evaluate(e=>e.click());
await page.waitForSelector(".expanded--settings");
const pid=Number(readFileSync("artifacts/codenotch/native-pid.txt","utf8").replace(/^\uFEFF/,"").trim());
const pwsh=process.env.ATOLL_PWSH || "pwsh";
const report={url:page.url(),checks:[]};
for(const edge of ["top","right","bottom","left"]) {
 await page.locator("[data-action=set-notch-edge][data-value="+edge+"]").evaluate(e=>e.click());
 await page.waitForFunction(e=>document.querySelector("#app")?.dataset.edge===e&&!document.querySelector("#app")?.hasAttribute("data-geometry-pending"),edge);
 await page.waitForFunction(()=>!document.querySelector("#app")?.hasAttribute("data-notch-animating"));
 await page.waitForTimeout(100);
 assert.equal(await page.locator("#app").getAttribute("data-notch-frame-error"),null);
 const dom=await page.evaluate(()=>{
  const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
  const edgeSamples=[];
  for(const path of document.querySelectorAll('.notch-outline,.notch-bubble-outline')) {
    const length=path.getTotalLength(), matrix=path.getScreenCTM();
    for(let i=0;i<32;i++) {
      const p=path.getPointAtLength(length*(i+.5)/32).matrixTransform(matrix);
      if(p.x>2&&p.x<innerWidth-2&&p.y>2&&p.y<innerHeight-2) edgeSamples.push({x:p.x,y:p.y});
    }
  }
  return{width:innerWidth,height:innerHeight,rail:box(".notch-rail"),panel:box(".notch-detail"),orb:box(".notch-settings"),edgeSamples};
 });
 const center=(r,name)=>({name,x:r.x+r.width/2,y:r.y+r.height/2,expected:true});
 const probes=[center(dom.rail,"rail"),center(dom.panel,"detail"),center(dom.orb,"settings"),{name:"transparent desktop corner",x:edge==="top"||edge==="bottom"?1:150,y:edge==="bottom"?dom.height-50:edge==="top"?50:1,expected:false}];
 for(const [index,p] of dom.edgeSamples.entries()) for(const delta of [-.4,.4]) probes.push({name:`antialias fringe ${index} ${delta}`,x:p.x+delta,y:p.y+delta,expected:true});
 writeFileSync("artifacts/codenotch/native-probes.json",JSON.stringify(probes));
 const raw=execFileSync(pwsh,["-NoProfile","-File","scripts/inspect-native-window.ps1","-AppProcessId",String(pid),"-ProbeFile","artifacts/codenotch/native-probes.json"],{encoding:"utf8",windowsHide:true});
 const native=JSON.parse(raw.trim().replace(/^\uFEFF/,""));
 for(const probe of native.probes)assert.equal(probe.hit,probe.expected,edge+" "+probe.name);
 assert.ok(native.noActivate&&native.toolWindow&&native.topmost,edge+" window policy");
 assert.notEqual(native.foreground,native.hwnd,edge+" does not take foreground focus");
 assert.ok(native.regionKind>0,edge+" installed window region");
 const work=native.work;
 if(edge==="top"||edge==="bottom"){
  assert.ok(Math.abs(native.x+(native.width/2)-(work.left+work.right)/2)<=1,edge+" centered");
  assert.ok(Math.abs(edge==="top"?native.y-work.top:native.y+native.height-work.bottom)<=1,edge+" anchored");
 }else{
  assert.ok(Math.abs(native.y+(native.height/2)-(work.top+work.bottom)/2)<=1,edge+" centered");
  assert.ok(Math.abs(edge==="left"?native.x-work.left:native.x+native.width-work.right)<=1,edge+" anchored");
 }
 assert.ok(Math.abs(dom.width*native.scale-native.width)<=2);
 assert.ok(Math.abs(dom.height*native.scale-native.height)<=2);
 report.checks.push({edge,dom,native});
}
await page.locator("[data-action=set-notch-edge][data-value=top]").evaluate(e=>e.click());
await page.locator("[data-action=collapse]").first().evaluate(e=>e.click());
await page.waitForFunction(()=>document.querySelector("#app")?.dataset.shell==="reef");
report.codexEnabled=await page.evaluate(()=>JSON.parse(localStorage.getItem("atoll.settings.v1")||"{}").codexUsageEnabled);
assert.notEqual(report.codexEnabled,true,"native smoke does not enable Codex");
writeFileSync("artifacts/codenotch/native-report.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
