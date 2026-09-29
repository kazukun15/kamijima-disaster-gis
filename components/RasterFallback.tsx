'use client';
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef,useState} from 'react';
import type {Geometry,Position} from 'geojson';
import type {MapProps} from './Map';
import {layers} from '@/lib/registry';
function world(lng:number,lat:number,z:number){const n=256*2**z;return [(lng+180)/360*n,(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n];}
function geographic(x:number,y:number,z:number):[number,number]{const n=256*2**z;return [x/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI];}
export default function RasterFallback(props:MapProps){
 const ref=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;center:number[]}|null>(null);const [size,setSize]=useState({width:800,height:600});
 useEffect(()=>{if(!ref.current)return;const ro=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));ro.observe(ref.current);return()=>ro.disconnect();},[]);
 const z=Math.max(2,Math.min(18,Math.round(props.view.zoom))),center=world(props.view.lng,props.view.lat,z),origin=[center[0]-size.width/2,center[1]-size.height/2];
 const screen=(p:Position)=>{const [x,y]=world(p[0],p[1],z);return [x-origin[0],y-origin[1]];};
 const path=(g:Geometry)=>{const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return polygons.flatMap(p=>p.map(r=>r.map((coord,i)=>`${i?'L':'M'}${screen(coord).join(',')}`).join(' ')+'Z')).join(' ');};
 const selected=layers.filter(l=>props.selected.includes(l.id)),tiles:{x:number;y:number;left:number;top:number}[]=[];
 for(let x=Math.floor(origin[0]/256);x<=Math.floor((origin[0]+size.width)/256);x++)for(let y=Math.floor(origin[1]/256);y<=Math.floor((origin[1]+size.height)/256);y++)if(x>=0&&y>=0&&x<2**z&&y<2**z)tiles.push({x,y,left:x*256-origin[0],top:y*256-origin[1]});
 const change=(zoom:number)=>props.onMove({lng:props.view.lng,lat:props.view.lat,zoom:Math.max(2,Math.min(18,zoom))});
 return <div ref={ref} className="raster-fallback" data-testid="raster-fallback" onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,center};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{const start=drag.current;if(!start)return;drag.current=null;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>5){const [lng,lat]=geographic(start.center[0]-dx,start.center[1]-dy,z);props.onMove({lng,lat,zoom:z});}else{const rect=e.currentTarget.getBoundingClientRect();props.onSelect(geographic(origin[0]+e.clientX-rect.left,origin[1]+e.clientY-rect.top,z));}}} onWheel={e=>change(z+(e.deltaY<0?1:-1))}>
  {tiles.map(t=><img draggable={false} key={`base-${t.x}-${t.y}`} alt="" width={256} height={256} style={{left:t.left,top:t.top}} src={`https://cyberjapandata.gsi.go.jp/xyz/${props.view.basemap==='photo'?'seamlessphoto':'pale'}/${z}/${t.x}/${t.y}.${props.view.basemap==='photo'?'jpg':'png'}`}/>)}
  {selected.filter(l=>l.kind==='raster'&&l.url).flatMap(l=>tiles.map(t=><img draggable={false} key={`${l.id}-${t.x}-${t.y}`} alt="" width={256} height={256} style={{left:t.left,top:t.top,opacity:(props.opacity[l.id]??65)/100}} src={l.url!.replace('{z}',String(z)).replace('{x}',String(t.x)).replace('{y}',String(t.y))}/>))}
  <svg width={size.width} height={size.height} aria-label="2D防災レイヤー">{selected.map(l=><g key={l.id} opacity={(props.opacity[l.id]??65)/100}>{props.datasets[l.id]?.features.map((f,i)=>f.geometry.type==='Point'?<circle key={i} cx={screen(f.geometry.coordinates)[0]} cy={screen(f.geometry.coordinates)[1]} r={5} fill={l.color} stroke="white"/>:<path key={i} d={path(f.geometry)} fill={l.id==='boundary'?'none':String(f.properties?.color??l.color)} fillRule="evenodd" stroke={l.id==='boundary'?l.color:'none'} strokeWidth={1}/>)}</g>)}{props.walking?.features.map((f,i)=><path key={`walk-${i}`} d={f.geometry.coordinates.map((p,j)=>`${j?'L':'M'}${screen(p).join(',')}`).join(' ')} fill="none" stroke="#b34a23" strokeWidth={4}/>)}{props.point&&<circle cx={screen(props.point)[0]} cy={screen(props.point)[1]} r={8} stroke="white" strokeWidth={3} fill="#163f47"/>}</svg>
  <div className="fallback-controls" onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}><button onClick={()=>change(z+1)} aria-label="拡大">＋</button><button onClick={()=>change(z-1)} aria-label="縮小">−</button></div>
  <div className="fallback-note">軽量2D表示 · WebGLを利用できません。ドラッグで移動。地籍・立体建物は非対応。<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a></div>
 </div>;
}
