import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ATOLL_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:'no-preference'});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const reports=[];
const base=process.env.ATOLL_PREVIEW_URL||"http://127.0.0.1:1425";
async function sample(){
 await page.evaluate(()=>{
  window.motionSamples=[];const start=performance.now();
  const record=()=>{const outline=document.querySelector('.notch-outline');if(!outline)return;const b=outline.getBBox();
   window.motionSamples.push({t:performance.now()-start,x:b.x,y:b.y,w:b.width,h:b.height,ringWidths:[...document.querySelectorAll('.notch-ring__visual')].map(e=>e.getBoundingClientRect().width),opacity:[...document.querySelectorAll('.notch-ring')].map(e=>+getComputedStyle(e).opacity)});
   if(performance.now()-start<900)requestAnimationFrame(record);
  };requestAnimationFrame(record);
 });
}
try{
 for(const edge of ['top','right','bottom','left']){
  await page.goto(`${base}/?preview=reef&edge=${edge}`);
  await page.waitForSelector('.notch-reef');await sample();
  await page.locator('.notch-reef').hover();
  await page.waitForTimeout(950);
  const samples=await page.evaluate(()=>window.motionSamples);
  const side=edge==='left'||edge==='right',depth=s=>side?s.w:s.h;
  assert.ok(samples.some(s=>depth(s)>15&&depth(s)<60),edge+' has intermediate contour frames');
  assert.ok(samples.every(s=>s.ringWidths.every(w=>Math.abs(w-44)<.05)),edge+' rings never scale');
  assert.ok(samples.some(s=>s.opacity.length===4&&s.opacity[0]>s.opacity[3]+.1),edge+' staggered cell arrival');
  await page.locator('[data-notch-panel=media]').hover();await page.waitForTimeout(950);
  const start=await page.locator('.notch-detail').boundingBox();
  await page.locator('[data-notch-panel=codex]').hover();await page.waitForTimeout(180);
  const middle=await page.locator('.notch-detail').boundingBox();
  await page.waitForTimeout(850);
  const end=await page.locator('.notch-detail').boundingBox();
  const along=r=>side?r.y:r.x;
  assert.ok(Math.abs(along(middle)-along(start))>2,edge+' tooltip starts travelling');
  assert.ok(Math.abs(along(middle)-along(end))>2,edge+' tooltip has not teleported to destination');
  await page.mouse.move(550,425);await page.waitForTimeout(1300);
  assert.equal(await page.locator('#app').getAttribute('data-shell'),'reef');
  assert.equal(await page.locator('.notch-motion-ghost').count(),0);
  assert.equal(await page.locator('#app').getAttribute('data-notch-frame-error'),null);
  reports.push({edge,frames:samples.length,constantRingSize:true,stagger:true,tooltipGlide:true,cleanDismissal:true});
 }
 assert.deepEqual(errors,[]);
 await writeFile('artifacts/codenotch/motion-report.json',JSON.stringify({reports,errors},null,2));
 console.log(JSON.stringify({reports,errors},null,2));
}finally{await browser.close()}
