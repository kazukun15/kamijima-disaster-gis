import {test,expect} from '@playwright/test';
test('ordinary drag pans and Ctrl drag rotates',async({page})=>{
 await page.goto('/#lat=34.2575&lng=133.2045&zoom=15&terrain=1&layers=boundary');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await page.getByRole('button',{name:'地点判定（中央）',exact:false}).click();const before=Number(await page.getByRole('spinbutton',{name:'経度'}).inputValue());
 const canvas=page.locator('.maplibregl-canvas'),box=(await canvas.boundingBox())!;const x=box.x+box.width*.6,y=box.y+box.height*.5;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+130,y,{steps:15});await page.mouse.up();
 await page.getByRole('button',{name:'地点判定（中央）',exact:false}).click();await expect.poll(async()=>{await page.getByRole('button',{name:'地点判定（中央）',exact:false}).click();return Math.abs(Number(await page.getByRole('spinbutton',{name:'経度'}).inputValue())-before);}).toBeGreaterThan(.0001);
 const compass=page.locator('.maplibregl-ctrl-compass .maplibregl-ctrl-icon');const initial=await compass.getAttribute('style');
 await page.keyboard.down('Control');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+130,y+45,{steps:15});await page.mouse.up();await page.keyboard.up('Control');
 await expect(compass).not.toHaveAttribute('style',initial??'');
});
test('landmarks open plan facts and source pages; shelter search retains plan information',async({page})=>{
 await page.goto('/#lat=34.2575&lng=133.2045&zoom=16&terrain=1&layers=public-facilities,shelter');await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 const landmark=page.getByRole('button',{name:'弓削総合支所の施設情報',exact:true});await expect(landmark).toBeVisible();await landmark.click();
 const info=page.getByRole('region',{name:'選択した施設の情報'});await expect(info).toContainText('2021年3月');await expect(info).toContainText('2,135');await info.getByText('計画の建物内訳を見る').click();await expect(info).toContainText('昭和51年11月1日');await expect(info.getByRole('link',{name:'計画PDF 10ページ ↗'})).toHaveAttribute('href',/#page=10$/);
 await page.screenshot({path:'docs/screenshots/facility-landmarks.png',fullPage:true});
 await page.getByRole('textbox',{name:'地名・施設・地番を検索'}).fill('せとうち');await page.locator('.search-results button').filter({hasText:'せとうち交流館'}).first().click();await expect(page.locator('.facility-info')).toContainText('1,569.63');
});
