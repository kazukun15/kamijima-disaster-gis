/** GSI PNG specification: signed 24-bit centimetres; 0x800000 is missing. */
export function decodeGsiHeight(r:number,g:number,b:number):number|null{
 const n=r*65536+g*256+b;
 return n===8388608?null:(n>8388608?n-16777216:n)*0.01;
}
/** Terrain-RGB stores decimetres offset by -10000 m. Missing is filled for rendering only. */
export function convertGsiPixels(pixels:Uint8ClampedArray):number{
 let missing=0;
 for(let i=0;i<pixels.length;i+=4){
  const h=pixels[i+3]===0?null:decodeGsiHeight(pixels[i],pixels[i+1],pixels[i+2]);
  if(h===null)missing++;
  const n=Math.max(0,Math.min(16777215,Math.round(((h??0)+10000)*10)));
  pixels[i]=Math.floor(n/65536);pixels[i+1]=Math.floor(n/256)%256;pixels[i+2]=n%256;pixels[i+3]=255;
 }
 return missing;
}
