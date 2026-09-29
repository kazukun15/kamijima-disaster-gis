import {assetUrl} from './asset-url';
export type CameraMode='top'|'bird'|'ground';
export type LightMode='morning'|'day'|'sunset'|'night';
export interface TwinSettings {exaggeration:1|1.5|2;camera:CameraMode;cameraSequence:number;autoRotate:boolean;light:LightMode;buildings:boolean;vegetation:boolean;water:boolean;coverage:boolean;debug:boolean;performance:'auto'|'quality'|'fast';}
export const initialTwin:TwinSettings={exaggeration:1,camera:'bird',cameraSequence:0,autoRotate:false,light:'day',buildings:true,vegetation:false,water:false,coverage:false,debug:false,performance:'auto'};
export interface TerrainSource {code:number;source:string;resolution:number;confidence:string;nativeZoom:number;url:string;}
export interface TerrainMetadata {generatedAt:string;nativeZoom:number;officialTiles:string[];visualTiles:string[];sourceLegend:TerrainSource[];totals:Record<string,number>;islands:{name:string;center:[number,number];counts:Record<string,number>;landCells:number}[];tileMetadata:Record<string,Record<string,number>>;}
export const terrainSources:TerrainSource[]=[{code:1,source:'DEM1A',resolution:1,confidence:'VERY HIGH',nativeZoom:17,url:'dem1a_png'},{code:2,source:'DEM5A',resolution:5,confidence:'HIGH',nativeZoom:15,url:'dem5a_png'},{code:3,source:'DEM5B',resolution:5,confidence:'MEDIUM-HIGH',nativeZoom:15,url:'dem5b_png'},{code:4,source:'DEM5C',resolution:5,confidence:'MEDIUM-HIGH',nativeZoom:15,url:'dem5c_png'},{code:5,source:'DEM10B',resolution:10,confidence:'MEDIUM',nativeZoom:14,url:'dem_png'}];
let metadataPromise:Promise<TerrainMetadata>|null=null;
export function loadTerrainMetadata(){
 if(!metadataPromise)metadataPromise=fetch(assetUrl('/data/terrain/metadata.json')).then(r=>{if(!r.ok)throw Error('Terrain metadata unavailable');return r.json() as Promise<TerrainMetadata>;}).catch(e=>{metadataPromise=null;throw e;});
 return metadataPromise;
}
export function tilePixel(lng:number,lat:number,z:number){const n=2**z,xf=(lng+180)/360*n,yf=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n,x=Math.floor(xf),y=Math.floor(yf);return {z,x,y,px:Math.max(0,Math.min(255,Math.floor((xf-x)*256))),py:Math.max(0,Math.min(255,Math.floor((yf-y)*256))),key:`${z}/${x}/${y}`};}
export function sourceForCode(code:number){return terrainSources.find(s=>s.code===code)??null;}
export function performanceMode(setting:TwinSettings['performance']){return setting==='fast'||(setting==='auto'&&(matchMedia('(max-width: 768px)').matches||((navigator as Navigator&{deviceMemory?:number}).deviceMemory??8)<=4));}
