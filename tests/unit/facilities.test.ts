import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {facilityFeatures} from '../../lib/facility-labels';
const read=(file:string)=>JSON.parse(readFileSync(`public/data/${file}`,'utf8'));
test('plan inventory matches the original 83 facilities and 167 buildings',()=>{const data=read('facility-plan.json');expect(data.facilities).toHaveLength(83);expect(data.facilities.reduce((n:number,p:{buildings:unknown[]})=>n+p.buildings.length,0)).toBe(167);expect(data.mapped).toBe(43);expect(data.facilities.reduce((n:number,p:{floorArea:number})=>n+p.floorArea,0)).toBeCloseTo(80130.34,2);});
test('all mapped plans have source positions and valid PDF page references',()=>{const data=read('public-facilities.geojson');for(const f of data.features){expect(f.properties.positionSource).toMatch(/^https:/);expect(f.properties.plan.buildings.every((b:{pdfPage:number})=>b.pdfPage>=7&&b.pdfPage<=11)).toBe(true);expect(f.geometry.coordinates[0]).toBeGreaterThan(133);}});
test('unselected facility layers do not produce floating labels',()=>{const data=read('public-facilities.geojson');expect(facilityFeatures({'public-facilities':data},[])).toEqual([]);expect(facilityFeatures({'public-facilities':data},['public-facilities']).length).toBeGreaterThan(0);});
