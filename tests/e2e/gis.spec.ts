import {readFileSync} from 'node:fs';
import {centroid,booleanPointInPolygon} from '@turf/turf';
import {test,expect} from '@playwright/test';
async function openLayers(page:import('@playwright/test').Page){const panel=page.getByRole('complementary',{name:'レイヤー'});if(!await panel.isVisible())await page.getByRole('button',{name:'レイヤーを選ぶ',exact:false}).click();await expect(panel).toBeVisible();}
test('map opens, layer toggle, point details and original sources',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await openLayers(page);
 await page.getByRole('checkbox',{name:'土砂災害警戒区域',exact:true}).check();
 await expect(page.getByRole('slider',{name:'土砂災害警戒区域の不透明度'})).toBeVisible();
 await page.getByRole('button',{name:'この地点を調べる',exact:false}).click();
 await expect(page.getByText('種類の想定区域への該当を確認')).toBeVisible();
 await expect(page.getByText('判定データなし').first()).toBeVisible();
 await openLayers(page);
 await page.getByRole('button',{name:'津波浸水想定の出典',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('2016年度版');
 await page.getByRole('button',{name:'閉じる',exact:true}).click();
 expect(errors).toEqual([]);
});
test('URL restores layers and scenario; empty layers stays empty',async({page})=>{
 await page.goto('/#lat=34.25&lng=133.2&zoom=13&layers=flood,boundary&scenario=rain');
 await openLayers(page);
 await expect(page.getByLabel('表示プリセット',{exact:true})).toHaveValue('rain');
 await expect(page.getByRole('checkbox',{name:'洪水浸水想定（想定最大規模）',exact:true})).toBeChecked();
 await expect(page.getByRole('checkbox',{name:'指定緊急避難場所',exact:true})).not.toBeChecked();
 await page.goto('/#layers=');await openLayers(page);await expect(page.getByRole('checkbox',{checked:true})).toHaveCount(0);
});
test('fresh visit starts in 3D and an explicit link keeps 2D',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'2Dに戻す',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByTestId('map-status')).toContainText('3D');
 await page.goto('/#terrain=0');
 await expect(page.getByRole('button',{name:'3D地形',exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(page.getByTestId('map-status')).toContainText('2D');
});
test('scenario switches and pending data is clearly marked',async({page})=>{
 await page.goto('/');await page.getByLabel('表示プリセット',{exact:true}).selectOption('earthquake');
 await openLayers(page);
 await expect(page.getByRole('checkbox',{name:'想定震度',exact:true})).toBeChecked();
 await expect(page.getByText('DATA_SOURCE_PENDING').first()).toBeVisible();
});
test('parcel search uses actual fields and Range serving',async({page,request})=>{
 const r=await request.get('/data/cadastral.pmtiles',{headers:{Range:'bytes=0-126'}});expect(r.status()).toBe(206);expect((await r.body()).length).toBe(127);
 await page.goto('/');await page.getByLabel('検索種別').selectOption('parcel');await page.getByRole('textbox',{name:'地名・施設・地番を検索'}).fill('生名 1218-1');
 const tileResponse=page.waitForResponse(r=>r.url().includes('cadastral.pmtiles')&&r.status()===206);
 await page.getByRole('button',{name:'生名 / 生名 1218-1',exact:false}).first().click();
 await expect(page.locator('.parcel-selection')).toContainText('1218-1');
 await openLayers(page);
 await expect(page.locator('.cadastral-note')).toContainText('未確定');
 await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await tileResponse;
 await page.waitForLoadState('networkidle');
 await page.screenshot({path:'docs/screenshots/cadastral.png',fullPage:true});
});
test('no parcel tiles are fetched below zoom 15 and location is opt in',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:()=>{throw Error('Unrequested geolocation');}}});});
 await page.goto('/#layers=boundary,cadastral&zoom=11');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');await page.waitForLoadState('networkidle');
 expect(requests.filter(u=>u.includes('cadastral.pmtiles'))).toEqual([]);expect(await page.evaluate(()=>localStorage.length)).toBe(0);
});
test('map click selects point',async({page})=>{await page.goto('/');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');await page.locator('.maplibregl-canvas').click({position:{x:230,y:230}});await expect(page.locator('.point-summary')).toBeVisible();});
test('print includes attribution and warning',async({page})=>{await page.goto('/');await page.emulateMedia({media:'print'});await expect(page.locator('.print-only')).toBeVisible();await expect(page.locator('.print-only')).toContainText('安全を保証しません');await expect(page.locator('.print-only')).toContainText('国土地理院');});
test('a failed dataset does not crash or become safe',async({page})=>{await page.route('**/data/landslide-warning.geojson',route=>route.abort());await page.goto('/');await page.getByRole('button',{name:'この地点を調べる',exact:false}).click();await expect(page.locator('.hazard-result').filter({hasText:'土砂災害警戒区域'})).toContainText('判定データなし');await expect(page.getByRole('heading',{level:1})).toBeVisible();});
for(const width of [360,390,768,1024,1440])test(`responsive ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width<=900){await page.getByRole('button',{name:'地点情報',exact:false}).click();await expect(page.locator('.detail-panel')).toBeVisible();await page.locator('.detail-panel').getByRole('button',{name:'閉じる',exact:true}).click();await page.getByRole('button',{name:'レイヤー',exact:false}).click();await expect(page.locator('.layer-panel')).toBeVisible();}
 else await openLayers(page);
 await page.screenshot({path:`docs/screenshots/${width}.png`,fullPage:true});
});
test('layer choices remain scrollable in a short desktop window',async({page})=>{
 await page.setViewportSize({width:935,height:524});await page.goto('/');await openLayers(page);
 const scroll=page.locator('.layer-scroll');
 expect(await scroll.evaluate(element=>element.getBoundingClientRect().height)).toBeGreaterThan(150);
 await scroll.evaluate(element=>{element.scrollTop=element.scrollHeight;});
 await expect(page.getByRole('checkbox',{name:'指定避難所',exact:true})).toBeInViewport();
 await page.screenshot({path:'docs/screenshots/layers-floating-short-window.png',fullPage:true});
});

test('aerial overlays, official point result and clean map UI',async({page})=>{
 const data=JSON.parse(readFileSync('public/data/landslide-special.geojson','utf8'));
 const boundary=JSON.parse(readFileSync('public/data/boundary.geojson','utf8'));
 const feature=data.features.find((f:Parameters<typeof booleanPointInPolygon>[1])=>booleanPointInPolygon(centroid(f),f,{ignoreBoundary:true})&&boundary.features.some((b:Parameters<typeof booleanPointInPolygon>[1])=>booleanPointInPolygon(centroid(f),b)));
 const [lng,lat]=centroid(feature).geometry.coordinates;
 await page.goto(`/#lat=${lat}&lng=${lng}&zoom=16&layers=boundary,landslide-warning,landslide-special`);
 await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 const photo=page.waitForResponse(r=>r.url().includes('/seamlessphoto/')&&r.status()===200);
 await openLayers(page);
 await page.getByRole('radio',{name:'航空写真',exact:true}).check();await photo;
 await expect(page.getByRole('checkbox',{name:'土砂災害特別警戒区域',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'レイヤーを閉じる'}).click();
 await page.getByRole('button',{name:'地点判定（中央）',exact:false}).click();
 const result=page.locator('.hazard-result').filter({hasText:'土砂災害特別警戒区域'});
 await expect(result).toContainText('想定区域に該当');await expect(result.locator('.hit-area').first()).toContainText(feature.properties.name);
 await expect(page.locator('.map-region .map-caption, .map-region .map-hint, .map-region .map-status, .map-region .cadastral-note')).toHaveCount(0);
 await page.waitForLoadState('networkidle');await page.screenshot({path:'docs/screenshots/aerial-point.png',fullPage:true});
 await openLayers(page);
 await page.getByRole('checkbox',{name:'土砂災害特別警戒区域',exact:true}).uncheck();await expect(result).toContainText('想定区域に該当');
 await page.getByRole('radio',{name:'淡色地図',exact:true}).check();await expect(page.locator('.point-summary')).toBeVisible();
 await page.getByRole('button',{name:'地点選択を解除'}).click();await expect(page.locator('.point-summary')).toHaveCount(0);
});

test('DEM terrain with aerial imagery can return to 2D',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#lat=34.260&lng=133.206&zoom=14&basemap=photo&layers=boundary,landslide-warning,landslide-special&terrain=0');
 await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 const dem=page.waitForResponse(r=>r.url().includes('/dem_png/')&&r.status()===200);
 await page.getByRole('button',{name:'3D地形',exact:true}).click();await dem;
 await expect(page.getByRole('button',{name:'2Dに戻す',exact:true})).toHaveAttribute('aria-pressed','true');
 await openLayers(page);
 await page.getByRole('checkbox',{name:'津波浸水想定',exact:true}).check();
 await expect(page.getByRole('checkbox',{name:'津波浸水想定',exact:true})).toBeChecked();
 await expect(page.getByTestId('map-status')).toContainText('3D');
 await page.getByRole('button',{name:'レイヤーを閉じる'}).click();
 await expect(page.getByRole('complementary',{name:'レイヤー'})).toBeHidden();
 await expect(page.getByTestId('map-status')).toContainText('3D');
 await page.waitForLoadState('networkidle');await page.waitForTimeout(1500);
 await page.screenshot({path:'docs/screenshots/terrain-3d.png',fullPage:true});
 await page.getByRole('button',{name:'地点判定（中央）',exact:false}).click();await expect(page.locator('.point-summary')).toBeVisible();
 await page.getByRole('button',{name:'2Dに戻す',exact:true}).click();await expect(page.getByTestId('map-status')).toContainText('2D');expect(errors).toEqual([]);
});
test('DEM network failure returns to 2D with an explanation',async({page})=>{
 await page.route('**/dem_png/**',route=>route.abort());
 await page.goto('/#lat=34.26&lng=133.206&zoom=14&terrain=0');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await page.getByRole('button',{name:'3D地形',exact:true}).click();await expect(page.getByText('地形データを取得できないため2D表示に戻しました。')).toBeVisible();await expect(page.getByTestId('map-status')).toContainText('2D');
});
test('mobile layer sheet remains usable in 3D',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#lat=34.260&lng=133.206&zoom=14&layers=boundary&terrain=0');
 await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await page.getByRole('button',{name:'3D地形',exact:true}).click();
 await expect(page.getByTestId('map-status')).toContainText('3D');
 await page.getByRole('button',{name:'レイヤー',exact:false}).click();
 await expect(page.getByRole('complementary',{name:'レイヤー'})).toBeVisible();
 await page.getByRole('checkbox',{name:'津波浸水想定',exact:true}).check();
 await expect(page.getByRole('checkbox',{name:'津波浸水想定',exact:true})).toBeChecked();
 await expect(page.getByTestId('map-status')).toContainText('3D');
});

test('tsunami polygons display over aerial imagery and report native depth',async({page})=>{
 const data=JSON.parse(readFileSync('public/data/tsunami.geojson','utf8'));
 const boundary=JSON.parse(readFileSync('public/data/boundary.geojson','utf8'));
 const feature=data.features.find((f:Parameters<typeof booleanPointInPolygon>[1])=>booleanPointInPolygon(centroid(f),f,{ignoreBoundary:true})&&boundary.features.some((b:Parameters<typeof booleanPointInPolygon>[1])=>booleanPointInPolygon(centroid(f),b)));
 const [lng,lat]=centroid(feature).geometry.coordinates;
 const response=page.waitForResponse(r=>r.url().endsWith('/data/tsunami.geojson')&&r.status()===200);
 await page.goto(`/#lat=${lat}&lng=${lng}&zoom=15&basemap=photo&layers=tsunami,boundary`);await response;
 await openLayers(page);
 await expect(page.getByRole('checkbox',{name:'津波浸水想定',exact:true})).toBeChecked();
 await expect(page.getByRole('slider',{name:'津波浸水想定の不透明度'})).toBeVisible();
 await page.getByLabel('緯度',{exact:true}).fill(String(lat));await page.getByLabel('経度',{exact:true}).fill(String(lng));await page.getByRole('button',{name:'この地点を調べる',exact:false}).click();
 const result=page.locator('.hazard-result').filter({hasText:'津波浸水想定'});await expect(result).toContainText('想定区域に該当');await expect(result).toContainText(feature.properties.classLabel);await expect(result).toContainText('2016年度版');
 await page.waitForLoadState('networkidle');await page.screenshot({path:'docs/screenshots/tsunami.png',fullPage:true});
});
