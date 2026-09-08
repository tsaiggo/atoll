import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import{mkdir,writeFile}from'node:fs/promises';
const require=createRequire(import.meta.url);
const{chromium}=require(process.env.ATOLL_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1000,height:720},reducedMotion:'reduce'});
const base=process.env.ATOLL_PREVIEW_URL||'http://127.0.0.1:1425';
const report=[];
try{
 await page.goto(base+'/?preview=expanded-codex&edge=right');await page.waitForSelector('.notch-detail');
 for(const language of ['en','zh-CN'])for(const [panel,status] of [...['disabled','checking','unavailable','signed_out','ready'].map(s=>['codex',s]),['media','empty'],['energy','empty'],['volume','muted']]){
  await page.evaluate(async({language,status,panel})=>{
   const {renderApp}=await import('/src/ui/render.ts');
   const {DEMO_CODEX_USAGE,DEMO_ENERGY}=await import('/src/domain.ts');
   renderApp(document.querySelector('#app'),{shell:'expanded',content:'idle',expandedPanel:panel,notchPinned:false,media:null,mediaConnection:{status:'unavailable',sessionCount:0,sources:[],manualSource:null},volume:{level:.68,muted:panel==='volume'},energy:panel==='energy'?{...DEMO_ENERGY,available:false,todayMwh:0,history:[]}:DEMO_ENERGY,codexUsage:{...DEMO_CODEX_USAGE,enabled:panel==='codex'&&status!=='disabled',status:panel==='codex'?status:'disabled',windows:status==='ready'?DEMO_CODEX_USAGE.windows:[]},selectedEnergyDayKey:null,settings:{language,hideInFullscreen:true,codexUsageEnabled:false,topMargin:0,notchEdge:'right',notchVisibility:'auto'},pendingMediaCommand:null,pendingMediaSeek:false,pendingSourceSelection:false,pendingCodexUsageAction:null,mediaCommandFeedback:null,showInlineVolume:false,animateContent:false,motionDisabled:true,now:Date.now()});
  },{language,status,panel});
  await page.waitForTimeout(35);
  const metrics=await page.locator('.notch-detail').evaluate(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight,text:e.innerText}));
  assert.ok(metrics.scrollWidth<=metrics.width+1,language+status+' horizontal text');
  assert.ok(metrics.scrollHeight<=metrics.height+1,language+status+' vertical text');
  assert.ok(metrics.text.trim().length>0,`${language} ${panel} ${status}: visible content`);
  report.push({language,panel,status,...metrics});
 }
 await mkdir('artifacts/codenotch',{recursive:true});
 await writeFile('artifacts/codenotch/state-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.map(({text,...r})=>r),null,2));
}finally{await browser.close()}
