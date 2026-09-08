import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ATOLL_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.connectOverCDP('http://127.0.0.1:9238');
const page=browser.contexts()[0].pages()[0];
const reports=[];
try {
 for(const edge of ['top','right','bottom','left']) {
  await page.evaluate(edge=>{const key='atoll.settings.v1';localStorage.setItem(key,JSON.stringify({...JSON.parse(localStorage.getItem(key)||'{}'),notchEdge:edge,notchVisibility:'auto',hideInFullscreen:false}));},edge);
  await page.reload();await page.waitForSelector('.notch-reef');
  // Observe the actual native watcher with the desktop cursor untouched.
  // Synthetic entry plus suppressed DOM exit reproduces a lost WebView leave.
  await page.evaluate(async()=>{
    window.nativePresence=[];
    const ipc=window.__TAURI_INTERNALS__;
    await ipc.invoke('plugin:event|listen',{event:'atoll-pointer-presence',target:{kind:'Any'},handler:ipc.transformCallback(e=>window.nativePresence.push(e.payload))});
    for(const type of ['pointerleave','pointerout'])window.addEventListener(type,e=>e.stopImmediatePropagation(),true);
  });
  await page.waitForFunction(()=>window.nativePresence.includes(false),{},{timeout:3000});
  await page.evaluate(()=>{
    document.querySelector('#app').dispatchEvent(new PointerEvent('pointerenter'));
    document.querySelector('[data-notch-panel=media]').click();
  });
  await page.waitForFunction(()=>document.querySelector('#app').dataset.shell==='expanded');
  await page.waitForFunction(()=>document.querySelector('#app').dataset.shell==='reef',{},{timeout:2500});
  reports.push({edge,missingDomLeaveRecovered:true,observedNativeOutside:await page.evaluate(()=>window.nativePresence.includes(false))});
 }
 assert.equal(reports.length,4);
 writeFileSync('artifacts/codenotch/native-pointer-report.json',JSON.stringify(reports,null,2));
 console.log(JSON.stringify(reports));
} finally {await browser.close();}
