import {assetUrl} from './asset-url';
import {decodeGsiHeight} from './terrain';
import {loadTerrainMetadata,sourceForCode,terrainSources,tilePixel,type TerrainSource} from './digital-twin';
export interface ElevationSample {height:number;source:TerrainSource;visualEnhanced:false;tile:string;}
async function pixel(url:string,x:number,y:number,signal:AbortSignal){
 const r=await fetch(url,{signal});if(r.status===404)return null;if(!r.ok)throw Error(`DEM ${r.status}`);
 const bitmap=await createImageBitmap(await r.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
 const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx){bitmap.close();throw Error('DEM canvas');}
 ctx.drawImage(bitmap,0,0);bitmap.close();return ctx.getImageData(x,y,1,1).data;
}
/** Only official unmodified cells enter point reports; visual PNGs are never read. */
export async function officialElevationAt(lng:number,lat:number,signal:AbortSignal):Promise<ElevationSample|null>{
 const p=tilePixel(lng,lat,17);let local=false;
 try{local=(await loadTerrainMetadata()).officialTiles.includes(p.key);}catch{signal.throwIfAborted();}
 if(local){
  try{
   const [value,code]=await Promise.all([pixel(assetUrl(`/data/terrain/official/${p.key}.png`),p.px,p.py,signal),pixel(assetUrl(`/data/terrain/sources/${p.key}.png`),p.px,p.py,signal)]);
   if(value&&code){const height=decodeGsiHeight(value[0],value[1],value[2]),source=sourceForCode(code[0]);if(height!==null&&source)return {height,source,visualEnhanced:false,tile:p.key};return null;}
  }catch{signal.throwIfAborted();}
 }
 for(const source of terrainSources){
  const t=tilePixel(lng,lat,source.nativeZoom);
  try{const value=await pixel(`https://cyberjapandata.gsi.go.jp/xyz/${source.url}/${t.key}.png`,t.px,t.py,signal);if(value){const height=decodeGsiHeight(value[0],value[1],value[2]);if(height!==null)return {height,source,visualEnhanced:false,tile:t.key};}}
  catch{signal.throwIfAborted();}
 }
 return null;
}
export async function elevationAt(lng:number,lat:number,signal:AbortSignal){return (await officialElevationAt(lng,lat,signal))?.height??null;}
