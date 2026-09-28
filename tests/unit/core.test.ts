import {assetUrl} from '../../lib/asset-url';
import {decodeGsiHeight,convertGsiPixels} from '../../lib/terrain';
import {describe,it,expect} from 'vitest';
import {polygon,featureCollection,pointOnFeature} from '@turf/turf';
import {readFileSync} from 'node:fs';
import {analyse,contains,overlapCount,nearest} from '../../lib/analysis';
import {layers,scenarios,validateRegistry} from '../../lib/registry';
import {parseState,serializeState,initialView} from '../../lib/url-state';
import type {Area,Facilities} from '../../lib/types';
// Synthetic geometry used ONLY in unit tests, never delivered as official GIS data.
const coverage=featureCollection([polygon([[[0,0],[10,0],[10,10],[0,10],[0,0]]])]);
const hazard=featureCollection([polygon([[[1,1],[3,1],[3,3],[1,3],[1,1]],[[1.5,1.5],[2.5,1.5],[2.5,2.5],[1.5,2.5],[1.5,1.5]]])]);
const l={...layers.find(x=>x.id==='landslide-warning')!,coverageVerified:true};
describe('Hazard states and geometry',()=>{
 it('detects polygon and boundary',()=>{expect(contains(hazard,[1.2,1.2])).toBe(true);expect(contains(hazard,[1,1])).toBe(true);});
 it('respects holes',()=>expect(contains(hazard,[2,2])).toBe(false));
 it('returns applicable only for an intersection',()=>expect(analyse(l,[1.2,1.2],hazard,coverage).state).toBe('APPLICABLE'));
 it('returns not applicable inside confirmed coverage',()=>expect(analyse(l,[5,5],hazard,coverage).state).toBe('NOT_APPLICABLE'));
 it('does not treat missing data as non applicable',()=>expect(analyse(l,[5,5],undefined,coverage).state).toBe('NO_DATA'));
 it('does not treat unknown coverage as non applicable',()=>expect(analyse({...l,coverageVerified:false},[5,5],hazard,coverage).state).toBe('NO_DATA'));
 it('does not infer coverage from a bbox',()=>expect(analyse(l,[12,12],hazard,coverage).state).toBe('OUT_OF_COVERAGE'));
 it('keeps loading distinct',()=>expect(analyse(l,[5,5],undefined,coverage,true).state).toBe('NOT_CHECKED'));
 it('refuses classification without administrative data',()=>expect(analyse(l,[5,5],hazard,undefined).state).toBe('NO_DATA'));
 it('never classifies a raster pixel',()=>expect(analyse(layers.find(l=>l.id==='flood')!,[2,2],hazard,coverage).state).toBe('NO_DATA'));
 it('counts disaster kinds, not warning + special sublayers',()=>{const hit=analyse(l,[1.2,1.2],hazard,coverage);expect(overlapCount({'landslide-warning':hit,'landslide-special':hit},layers)).toBe(1);});
});
describe('Registry, metadata, scenarios, URL',()=>{
 it('validates all metadata and legends',()=>expect(validateRegistry()).toBe(true));
 it('rejects duplicate IDs',()=>expect(()=>validateRegistry([l,l])).toThrow());
 it('rejects missing attribution',()=>expect(()=>validateRegistry([{...l,publisher:''}])).toThrow());
 it('requires all scenario references to exist',()=>{for(const s of Object.values(scenarios))for(const id of s.layers)expect(layers.some(l=>l.id===id)).toBe(true);});
 it('round trips share state',()=>expect(parseState(serializeState(initialView))).toEqual(initialView));
 it('preserves an explicitly empty layer list',()=>expect(parseState('layers=').layers).toEqual([]));
 it('filters invalid, duplicate layer IDs',()=>expect(parseState('layers=boundary,boundary,evil').layers).toEqual(['boundary']));
 it('rejects nonfinite and out of range coordinates',()=>{const s=parseState('lat=Infinity&lng=300&zoom=-9');expect(s.lat).toBe(initialView.lat);expect(s.lng).toBe(initialView.lng);expect(s.zoom).toBe(initialView.zoom);});
 it('rejects prototype keys as scenarios',()=>expect(parseState('scenario=toString').scenario).toBe('custom'));
});
describe('Real processed data integrity',()=>{
 const read=(id:string)=>JSON.parse(readFileSync(`public/data/${id}.geojson`,'utf8'));
 it('contains the expected town facilities and excludes 大崎上島町',()=>{const f=read('emergency') as Facilities;expect(f.features).toHaveLength(121);for(const x of f.features)expect(x.properties?.address).toMatch(/^愛媛県(?:越智郡)?上島町/);});
 it('separates emergency locations and shelters',()=>expect(read('shelter').features).toHaveLength(44));
 it('does not publish owner or taxation fields',()=>{for(const id of ['emergency','shelter','landslide-warning','landslide-special'])for(const f of read(id).features)expect(Object.keys(f.properties).join(' ')).not.toMatch(/所有者|課税|氏名|電話/);});
 it('finds a real official warning polygon point inside town',()=>{const data=read('landslide-warning') as Area,b=read('boundary') as Area;const p=data.features.map(f=>pointOnFeature(f).geometry.coordinates as [number,number]).find(p=>contains(b,p))!;expect(analyse(l,p,data,b).state).toBe('APPLICABLE');});
 it('sorts nearby facilities by distance',()=>{const f=read('emergency') as Facilities;const p=f.features[0].geometry.coordinates as [number,number];expect(nearest(p,f)[0].km).toBe(0);});
 it('has a PMTiles v3 header and full parcel index',()=>{const b=readFileSync('public/data/cadastral.pmtiles');expect(b.subarray(0,7).toString()).toBe('PMTiles');expect(b[7]).toBe(3);expect(JSON.parse(readFileSync('public/data/parcel-search.json','utf8'))).toHaveLength(40757);});
});

describe('Aerial background and point detail',()=>{
 it('restores aerial selection and rejects unknown backgrounds',()=>{expect(parseState('basemap=photo').basemap).toBe('photo');expect(parseState('basemap=unknown').basemap).toBe('map');expect(parseState(serializeState({...initialView,basemap:'photo'})).basemap).toBe('photo');});
 it('preserves official attributes for each intersecting zone',()=>{const data=featureCollection([polygon([[[1,1],[3,1],[3,3],[1,3],[1,1]]],{name:'区域A',phenomenon:'土石流',noticeDate:'2020-01-01',areaCode:'A'})]);const result=analyse(l,[2,2],data,coverage);expect(result.matches).toBe(1);expect(result.areas).toEqual([{name:'区域A',phenomenon:'土石流',noticeDate:'2020-01-01',areaCode:'A'}]);});
});

describe('GSI DEM decoding for 3D terrain',()=>{
 it('decodes positive, negative and missing centimetre values',()=>{expect(decodeGsiHeight(0,0,100)).toBe(1);expect(decodeGsiHeight(255,255,156)).toBe(-1);expect(decodeGsiHeight(128,0,0)).toBeNull();});
 it('converts valid elevations and only fills missing pixels for rendering',()=>{const p=new Uint8ClampedArray([0,0,100,255,255,255,156,255,128,0,0,255]);expect(convertGsiPixels(p)).toBe(1);const height=(i:number)=>-10000+(p[i]*65536+p[i+1]*256+p[i+2])*0.1;expect(height(0)).toBeCloseTo(1);expect(height(4)).toBeCloseTo(-1);expect(height(8)).toBe(0);});
 it('restores terrain mode without interpreting arbitrary values as true',()=>{expect(parseState('terrain=1').terrain).toBe(true);expect(parseState('terrain=true').terrain).toBe(false);expect(parseState(serializeState({...initialView,terrain:true})).terrain).toBe(true);});
});

describe('Official tsunami polygons',()=>{
 const data=JSON.parse(readFileSync('public/data/tsunami.geojson','utf8')) as Area;
 const boundary=JSON.parse(readFileSync('public/data/boundary.geojson','utf8')) as Area;
 const tsunami=layers.find(l=>l.id==='tsunami')!;
 it('preserves native depth classes, metadata and 3332 shapes',()=>{expect(data.features).toHaveLength(3332);expect(tsunami.kind).toBe('polygon');expect(tsunami.effectiveDate).toBe('2016-10-31');for(const f of data.features){expect(tsunami.legend.some(x=>x.label===f.properties?.classLabel&&x.color===f.properties?.color)).toBe(true);expect(f.properties?.sourceDepthClass).toBe(f.properties?.classLabel);}});
 it('classifies a real tsunami polygon point with its original depth label',()=>{const p=data.features.map(f=>pointOnFeature(f).geometry.coordinates as [number,number]).find(p=>contains(boundary,p))!;const r=analyse(tsunami,p,data,boundary);expect(r.state).toBe('APPLICABLE');expect(r.classLabel).toContain('m');});
 it('does not promise non-applicability from the extent of an old dataset',()=>{expect(tsunami.coverageVerified).toBe(false);});
});

describe('GitHub Pages project URLs',()=>{
 it('resolves GeoJSON and PMTiles under the repository path',()=>{expect(assetUrl('/data/tsunami.geojson','/kamijima-disaster-gis')).toBe('/kamijima-disaster-gis/data/tsunami.geojson');expect(assetUrl('/data/cadastral.pmtiles','/kamijima-disaster-gis/')).toBe('/kamijima-disaster-gis/data/cadastral.pmtiles');});
 it('keeps official URLs and localhost assets intact',()=>{expect(assetUrl('https://example.org/tile.png','/repo')).toBe('https://example.org/tile.png');expect(assetUrl('/data/tsunami.geojson','')).toBe('/data/tsunami.geojson');});
});
