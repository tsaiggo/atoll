// Rasterize the authored SVG masters, then run `pnpm tauri icon assets/atoll-icon.png`.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ATOLL_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1});
try {
 for(const [master,out,size] of [['assets/atoll-icon.svg','assets/atoll-icon.png',1024],['assets/atoll-tray.svg','src-tauri/icons/tray-32.png',32],['assets/atoll-tray.svg','assets/atoll-tray-16.png',16]]) {
  let svg=await readFile(master,'utf8');
  if(svg.includes('atoll-icon-paint.png')) {
   const paint=await readFile('assets/atoll-icon-paint.png');
   svg=svg.replace('href="atoll-icon-paint.png"',`href="data:image/png;base64,${paint.toString('base64')}"`);
  }
  await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img id="icon" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`);
  await page.locator('#icon').evaluate(img=>img.decode());
  await page.locator('#icon').screenshot({path:out,omitBackground:true});
  console.log(out);
 }
 if(process.env.ATOLL_ICON_REVIEW) {
  await mkdir('artifacts/icon-redesign',{recursive:true});
  const data=async path=>`data:image/png;base64,${(await readFile(path)).toString('base64')}`;
  const app=await data('assets/atoll-icon.png'),tray=await data('src-tauri/icons/tray-32.png');
  if(!process.env.ATOLL_REFERENCE_ICON) throw new Error('Set ATOLL_REFERENCE_ICON to the local reference PNG when requesting a review board.');
  const original=await data(process.env.ATOLL_REFERENCE_ICON);
  const html=`<style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#eef0f3;color:#20242c;font:15px 'Segoe UI',sans-serif}h1{font-size:24px;margin:0 0 6px}p{margin:0 0 24px;color:#626874}.comparison{display:flex;gap:32px}.block{flex:1;text-align:center;background:#fff;border-radius:16px;padding:14px}.hero{width:260px;max-width:100%}.dark{background:#181b21;color:white}h2{font-size:16px;font-weight:500;margin:8px}.sizes{display:flex;align-items:center;justify-content:center;gap:24px;height:144px}.sizes img{object-fit:contain}.tray{display:flex;align-items:center;justify-content:center;gap:20px;padding:20px;margin-top:20px;border-radius:12px;background:#d4d7dd}.tray.dark{background:#181b21}.caption{font-size:12px;color:#6c727a;text-align:center;margin-top:8px}@media(max-width:600px){body{padding:18px}.comparison{gap:12px}.block{padding:8px}.hero{width:160px}.sizes{gap:12px}.sizes img:first-child,.large-size-label{display:none}}</style><h1>Atoll / Floating Island</h1><p>Approved painted artwork. Floating capsule, status light and rhythm bars.</p><div class="comparison"><div class="block"><h2>Approved design</h2><img class="hero" src="${original}"></div><div class="block"><h2>Atoll</h2><img class="hero" src="${app}"></div><div class="block dark"><h2>Atoll / dark desktop</h2><img class="hero" src="${app}"></div></div><div class="sizes">${[128,64,48,32,24,16].map(size=>`<img width="${size}" height="${size}" src="${app}" title="${size}px">`).join('')}</div><div class="caption"><span class="large-size-label">128 / </span>64 / 48 / 32 / 24 / 16 px</div><div class="comparison"><div class="block"><h2>Tray / light</h2><div class="tray">${[32,24,16].map(size=>`<img width="${size}" height="${size}" src="${tray}">`).join('')}</div></div><div class="block dark"><h2>Tray / dark</h2><div class="tray dark">${[32,24,16].map(size=>`<img width="${size}" height="${size}" src="${tray}">`).join('')}</div></div></div>`;
  await writeFile('artifacts/icon-redesign/review.html',html);
  await page.setViewportSize({width:1180,height:790});await page.setContent(html);await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));await page.screenshot({path:'artifacts/icon-redesign/review-desktop.png',fullPage:true});
  await page.setViewportSize({width:480,height:760});await page.screenshot({path:'artifacts/icon-redesign/review-mobile.png',fullPage:true});
 }
} finally {await browser.close();}
