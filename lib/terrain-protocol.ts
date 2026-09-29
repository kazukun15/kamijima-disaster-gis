import type {AddProtocolAction} from 'maplibre-gl';
import {convertGsiPixels} from './terrain';
import {assetUrl} from './asset-url';
import {loadTerrainMetadata} from './digital-twin';
export function terrainProtocol(onMissing:()=>void,onFallback:()=>void=()=>{}):AddProtocolAction{
 return async(params,controller)=>{
  const match=/^gsi-dem:\/\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
  if(!match)throw Error('Invalid DEM tile');
  const [,z,x,y]=match;
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
  try{
   const metadata=await loadTerrainMetadata();
   if(metadata.visualTiles.includes(`${z}/${x}/${y}`)){
    const local=await fetch(assetUrl(`/data/terrain/visual/${z}/${x}/${y}.png`),{signal});
    if(local.ok)return {data:await local.arrayBuffer()};
    onFallback();
   }
  }catch{signal.throwIfAborted();onFallback();}
  const shift=Math.max(0,Number(z)-14),scale=2**shift,baseZ=Math.min(Number(z),14),baseX=Math.floor(Number(x)/scale),baseY=Math.floor(Number(y)/scale);
  const r=await fetch(`https://cyberjapandata.gsi.go.jp/xyz/dem_png/${baseZ}/${baseX}/${baseY}.png`,{signal});
  if(!r.ok&&r.status!==404)throw Error(`DEM HTTP ${r.status}`);
  const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('DEM canvas unavailable');
  if(r.ok){const bitmap=await createImageBitmap(await r.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});ctx.imageSmoothingEnabled=false;ctx.drawImage(bitmap,(Number(x)%scale)*256/scale,(Number(y)%scale)*256/scale,256/scale,256/scale,0,0,256,256);bitmap.close();}
  const pixels=ctx.getImageData(0,0,256,256);
  if(convertGsiPixels(pixels.data)>0)onMissing();
  ctx.putImageData(pixels,0,0);
  const blob=await canvas.convertToBlob({type:'image/png'});signal.throwIfAborted();
  return {data:await blob.arrayBuffer()};
 };
}
export function coverageProtocol():AddProtocolAction{
 return async(params,controller)=>{
  const key=params.url.replace('gsi-coverage://','');
  const metadata=await loadTerrainMetadata();
  if(metadata.visualTiles.includes(key)){
   const r=await fetch(assetUrl(`/data/terrain/confidence/${key}.png`),{signal:controller.signal});
   if(r.ok)return {data:await r.arrayBuffer()};
  }
  const canvas=new OffscreenCanvas(256,256);return {data:await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer()};
 };
}
