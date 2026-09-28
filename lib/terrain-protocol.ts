import type {AddProtocolAction} from 'maplibre-gl';
import {convertGsiPixels} from './terrain';
export function terrainProtocol(onMissing:()=>void):AddProtocolAction{
 return async(params,controller)=>{
  const match=/^gsi-dem:\/\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
  if(!match)throw Error('Invalid DEM tile');
  const [,z,x,y]=match;
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
  const r=await fetch(`https://cyberjapandata.gsi.go.jp/xyz/dem_png/${z}/${x}/${y}.png`,{signal});
  if(!r.ok&&r.status!==404)throw Error(`DEM HTTP ${r.status}`);
  const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('DEM canvas unavailable');
  if(r.ok){const bitmap=await createImageBitmap(await r.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});ctx.drawImage(bitmap,0,0);bitmap.close();}
  const pixels=ctx.getImageData(0,0,256,256);
  if(convertGsiPixels(pixels.data)>0)onMissing();
  ctx.putImageData(pixels,0,0);
  const blob=await canvas.convertToBlob({type:'image/png'});signal.throwIfAborted();
  return {data:await blob.arrayBuffer()};
 };
}
