import {test,expect} from '@playwright/test';
test('one failed terrain tile does not disable the whole 3D map',async({page})=>{
 let failures=0, success=0;
 await page.route('**/data/terrain/visual/**',async r=>{if(failures===0){failures++;await r.abort();}else{success++;await r.continue();}});
 await page.route('**/dem_png/**',async r=>{if(failures===1){failures++;await r.fulfill({status:503,body:'temporary'});}else await r.continue();});
 await page.goto('/#lat=34.257&lng=133.204&zoom=15&terrain=1');
 await expect(page.getByTestId('map-status')).toContainText('地図操作が可能');
 await expect.poll(()=>failures,{timeout:15000}).toBe(2);
 await expect.poll(()=>success,{timeout:15000}).toBeGreaterThan(0);
 await expect(page.getByTestId('map-status')).toContainText('3D',{timeout:10000});
 await expect(page.getByTestId('map-status')).toContainText('地形データの取得に失敗した箇所があります');
 await page.waitForTimeout(3500);
 await expect(page.getByTestId('map-status')).toContainText('3D');
});
test('3D opens with a visible relief setting and can return to true scale',async({page})=>{
 await page.goto('/');
 await expect(page.getByTestId('map-status')).toContainText('3D');
 await expect(page.getByTestId('map-status')).toContainText('標高誇張中 1.5×');
 await page.getByRole('button',{name:'3D設定',exact:true}).click();
 await expect(page.getByRole('button',{name:'1.5×',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'1.0×',exact:true}).click();
 await expect(page.getByRole('button',{name:'1.0×',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByTestId('map-status')).not.toContainText('標高誇張中');
});
