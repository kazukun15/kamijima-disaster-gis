// GSI DEM10B text tiles; 'e' is missing, never zero. Coordinates stay in browser memory.
export async function elevationAt(lng:number,lat:number,signal:AbortSignal):Promise<number|null>{
 const z=14,n=2**z,xf=(lng+180)/360*n,yf=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n;
 const x=Math.floor(xf),y=Math.floor(yf),px=Math.floor((xf-x)*256),py=Math.floor((yf-y)*256);
 const r=await fetch(`https://cyberjapandata.gsi.go.jp/xyz/dem/${z}/${x}/${y}.txt`,{signal,referrerPolicy:'no-referrer'});
 if(!r.ok)throw new Error('DEM unavailable');
 const cell=(await r.text()).trim().split('\n')[py]?.split(',')[px]?.trim();
 return cell&&cell!=='e'&&Number.isFinite(Number(cell))?Number(cell):null;
}
