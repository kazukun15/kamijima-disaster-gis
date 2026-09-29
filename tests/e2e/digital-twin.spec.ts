import {test,expect} from '@playwright/test';
test.describe('offline cache',()=>{
test.use({serviceWorkers:'allow'});
test('offline reload retains the cached shell and explains missing coverage',async({page,context})=>{
 await page.goto('/#terrain=0');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await expect.poll(()=>page.evaluate(async()=>{const names=await caches.keys();for(const name of names){if(name.endsWith('-shell')){const keys=await (await caches.open(name)).keys();return keys.filter(key=>key.url.includes('/_next/static/')).length;}}return 0;})).toBeGreaterThan(5);
 await page.reload();await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.locator('.offline-status')).toContainText('保存済み');
 await page.getByRole('button',{name:/レイヤーを選ぶ/}).click();await expect(page.locator('#layer-panel')).toBeVisible();
});

});

test('touch sized 3D controls work on a mobile viewport',async({browser})=>{
 const context=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();
 await page.goto('http://127.0.0.1:4173/#terrain=1');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await page.getByRole('button',{name:'3D設定',exact:true}).tap();await expect(page.locator('.twin-panel')).toBeVisible();
 await page.getByRole('button',{name:'2.0×',exact:true}).tap();await expect(page.getByTestId('map-status')).toContainText('標高誇張中');
 const box=await page.getByRole('button',{name:'鳥瞰',exact:true}).boundingBox();expect(box?.height).toBeGreaterThanOrEqual(44);
 await page.screenshot({path:'docs/screenshots/digital-twin-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'3D設定を閉じる'}).tap();await page.locator('.mobile-tabs').getByRole('button',{name:/レイヤー/}).tap();await expect(page.locator('#layer-panel')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
});

test('lost GPU context switches to the usable 2D fallback',async({page})=>{
 await page.goto('/');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await page.locator('.maplibregl-canvas').dispatchEvent('webglcontextlost');await expect(page.getByTestId('raster-fallback')).toBeVisible();
 await page.getByRole('button',{name:'この地点を調べる',exact:false}).click();await expect(page.locator('.point-summary')).toBeVisible();
});
test('hybrid terrain, buildings, source provenance and camera controls',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const building=page.waitForResponse(r=>r.url().includes('buildings.pmtiles')&&r.status()===206);
 await page.goto('/#lat=34.25713&lng=133.204149&zoom=16&terrain=1&layers=boundary,tsunami');
 await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');await building;
 await page.getByRole('spinbutton',{name:'緯度'}).fill('34.271');await page.getByRole('spinbutton',{name:'経度'}).fill('133.211');
 await page.getByRole('button',{name:'この地点を調べる',exact:false}).click();
 await expect(page.locator('.elevation-source')).toContainText('GSI DEM1A');await expect(page.locator('.elevation-source')).toContainText('1 m');
 await page.getByRole('button',{name:'3D設定',exact:true}).click();
 await page.getByRole('button',{name:'1.5×',exact:true}).click();await expect(page.getByTestId('map-status')).toContainText('標高誇張中');
 await page.getByRole('button',{name:'真上',exact:true}).click();await expect(page.getByRole('button',{name:'真上',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'鳥瞰',exact:true}).click();
 await page.getByText('Developer Mode',{exact:true}).click();
 await page.getByRole('checkbox',{name:'DEM Coverageを重ねる'}).check();
 await page.getByRole('checkbox',{name:'タイル境界・描画情報'}).check();await expect(page.locator('.terrain-debug')).toContainText('Terrain LOD');
 await page.screenshot({path:'docs/screenshots/digital-twin-coverage.png',fullPage:true});
 await page.getByRole('button',{name:'3D設定を閉じる'}).click();
 await page.getByRole('button',{name:'2Dに戻す',exact:true}).click();await expect(page.getByTestId('map-status')).toContainText('2D');
 expect(errors).toEqual([]);
});
test('unavailable hybrid tile falls back to standard terrain',async({page})=>{
 await page.route('**/data/terrain/visual/**',r=>r.abort());
 await page.goto('/#lat=34.257&lng=133.204&zoom=15&terrain=1');
 await expect(page.getByText('高精細地形を取得できない部分は、標準のDEM10Bで表示しています。')).toBeVisible();
 await expect(page.getByTestId('map-status')).toContainText('3D');
});
test('WebGL unavailable uses a usable raster and SVG 2D map',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type.includes('webgl'))return null;return original.apply(this,[type,...args] as Parameters<typeof original>);} as typeof original;});
 await page.goto('/');await expect(page.getByTestId('raster-fallback')).toBeVisible();await expect(page.getByTestId('map-status')).toContainText('2D');
 await page.getByRole('button',{name:'この地点を調べる',exact:false}).click();await expect(page.locator('.point-summary')).toBeVisible();
});
test('slope walking in a worker and current-location accuracy remain usable',async({page,context})=>{
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:34.25713,longitude:133.204149,accuracy:20});
 await page.goto('/#lat=34.25713&lng=133.204149&zoom=15&terrain=1');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await page.getByRole('button',{name:'現在地',exact:false}).click();await expect(page.locator('.point-summary')).toBeVisible();
 await page.getByRole('button',{name:'10分',exact:true}).click();await page.getByRole('combobox',{name:'歩行モデル'}).selectOption('slope');
 const worker=page.waitForEvent('worker');await page.getByRole('button',{name:'到達範囲を表示'}).click();await worker;
 await expect(page.locator('.walking-status')).toContainText('勾配反映');await expect(page.locator('.walking-status')).toContainText('平地扱い');
 await page.getByRole('button',{name:'3D設定',exact:true}).click();await page.getByRole('checkbox',{name:'津波の浸水深区分を立体表示'}).check();
 await page.getByRole('button',{name:'3D設定を閉じる'}).click();await page.screenshot({path:'docs/screenshots/digital-twin-walking.png',fullPage:true});
 await page.getByRole('button',{name:'5分',exact:true}).click();await expect(page.locator('.walking-status')).toHaveCount(0);
});
