import {layers,scenarios} from './registry';
import type {ViewState} from './types';
export const initialView:ViewState={lat:34.245,lng:133.235,zoom:10.4,layers:['tsunami','boundary','emergency'],scenario:'custom',basemap:'map',terrain:false};
export function parseState(search:string):ViewState{
 const p=new URLSearchParams(search.replace(/^#/,''));
 const num=(key:string,fallback:number,min:number,max:number)=>{const raw=p.get(key);const v=raw===null||raw.trim()===''?NaN:Number(raw);return Number.isFinite(v)&&v>=min&&v<=max?v:fallback;};
 const scenario=p.get('scenario')??'custom';
 const selected=p.has('layers')?(p.get('layers')??'').split(',').filter(id=>layers.some(l=>l.id===id)):initialView.layers;
 return {lat:num('lat',initialView.lat,-85,85),lng:num('lng',initialView.lng,-180,180),zoom:num('zoom',initialView.zoom,2,19),layers:[...new Set(selected)],terrain:p.get('terrain')==='1',basemap:p.get('basemap')==='photo'?'photo':'map',scenario:Object.hasOwn(scenarios,scenario)?scenario:'custom'};
}
export function serializeState(s:ViewState){return new URLSearchParams({lat:s.lat.toFixed(6),lng:s.lng.toFixed(6),zoom:s.zoom.toFixed(2),layers:s.layers.join(','),scenario:s.scenario,basemap:s.basemap,terrain:s.terrain?'1':'0'}).toString();}
