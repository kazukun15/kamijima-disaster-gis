import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {sourceForCode,tilePixel,type TerrainMetadata} from '../../lib/digital-twin';
import {illustrativeDepth} from '../../lib/water-depth';
describe('Hybrid terrain provenance and derived display',()=>{
 const metadata=JSON.parse(readFileSync('public/data/terrain/metadata.json','utf8')) as TerrainMetadata;
 it('has distinct real island coverage and keeps missing cells explicit',()=>{expect(metadata.islands.length).toBeGreaterThanOrEqual(5);expect(new Set(metadata.islands.map(i=>i.center.join(','))).size).toBe(metadata.islands.length);expect(metadata.totals.NO_DATA).toBeGreaterThan(0);expect(metadata.totals.DEM1A).toBeGreaterThan(metadata.totals.DEM10B);});
 it('keeps official source priority explicit',()=>{expect(sourceForCode(1)?.source).toBe('DEM1A');expect(sourceForCode(5)?.source).toBe('DEM10B');expect(sourceForCode(0)).toBeNull();});
 it('finds the sampled official DEM1A tile',()=>expect(metadata.officialTiles).toContain(tilePixel(133.211,34.271,17).key));
 it('uses the depth class representative only when the class is numeric',()=>{expect(illustrativeDepth('0.3m以上 ～ 1m未満')).toBe(.65);expect(illustrativeDepth('10m以上')).toBe(10);expect(illustrativeDepth('不明')).toBeNull();});
 it('keeps every building height explicitly estimated in this extract',()=>{const b=JSON.parse(readFileSync('public/data/buildings-metadata.json','utf8'));expect(b.buildings).toBeGreaterThan(0);expect(b.estimatedBuildings).toBe(b.buildings);expect(b.taggedHeights).toBe(0);});
});
