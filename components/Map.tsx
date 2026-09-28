'use client';
import {useEffect,useRef,useState} from 'react';
import maplibregl, {type Map as MapInstance, type GeoJSONSource} from 'maplibre-gl';
import {Protocol} from 'pmtiles';
import type {FeatureCollection} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import {assetUrl} from '@/lib/asset-url';
import {layers} from '@/lib/registry';
import {terrainProtocol} from '@/lib/terrain-protocol';
import type {ViewState} from '@/lib/types';
export interface MapProps {
 view:ViewState; selected:string[]; opacity:Record<string,number>; datasets:Record<string,FeatureCollection>;
 destination:{lng:number;lat:number;zoom:number;sequence:number}|null; point:[number,number]|null;
 onSelect:(p:[number,number])=>void; onMove:(v:{lng:number;lat:number;zoom:number})=>void;
 onError:(id:string)=>void; onReady:()=>void; onTerrainMissing:()=>void; onTerrainFailure:()=>void;
 onParcel:(properties:Record<string,unknown>|null)=>void;
}
export default function MapView(props:MapProps){
 const container=useRef<HTMLDivElement>(null),map=useRef<MapInstance|null>(null),marker=useRef<maplibregl.Marker|null>(null);
 const callbacks=useRef(props);const [ready,setReady]=useState(false);const [fatal,setFatal]=useState(false);
 useEffect(()=>{callbacks.current=props;},[props]);
 useEffect(()=>{
  if(!container.current)return;
  const protocol=new Protocol();maplibregl.addProtocol('pmtiles',protocol.tile);
  maplibregl.addProtocol('gsi-dem',terrainProtocol(()=>callbacks.current.onTerrainMissing()));
  let m:MapInstance;
  try{
   m=new maplibregl.Map({container:container.current,center:[callbacks.current.view.lng,callbacks.current.view.lat],zoom:callbacks.current.view.zoom,maxZoom:19,minZoom:2,maxPitch:70,attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true},style:{version:8,sources:{base:{type:'raster',tiles:['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],tileSize:256,maxzoom:18,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#e3eceb'}},{id:'base',type:'raster',source:'base',paint:{'raster-saturation':-0.35}}]}});
  }catch{setFatal(true);callbacks.current.onError('map');return;}
  map.current=m;
  m.addControl(new maplibregl.NavigationControl({showCompass:true,visualizePitch:true}),'top-right');
  m.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
  m.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
  m.on('click',e=>{callbacks.current.onSelect([e.lngLat.lng,e.lngLat.lat]);const features=m.getLayer('cadastral')?m.queryRenderedFeatures([[e.point.x-3,e.point.y-3],[e.point.x+3,e.point.y+3]],{layers:['cadastral']}):[];callbacks.current.onParcel(features[0]?.properties??null);});
  m.on('moveend',()=>{const c=m.getCenter();callbacks.current.onMove({lng:c.lng,lat:c.lat,zoom:m.getZoom()});});
  m.on('error',e=>{const id=(e as typeof e & {sourceId?:string}).sourceId??'map';callbacks.current.onError(id);if(id==='terrain-dem')callbacks.current.onTerrainFailure();});
  m.on('style.load',()=>{setReady(true);callbacks.current.onReady();});
  const resize=new ResizeObserver(()=>m.resize());resize.observe(container.current);
  const printResize=()=>m.resize();window.addEventListener('beforeprint',printResize);window.addEventListener('afterprint',printResize);
  return()=>{resize.disconnect();window.removeEventListener('beforeprint',printResize);window.removeEventListener('afterprint',printResize);marker.current?.remove();m.remove();maplibregl.removeProtocol('pmtiles');maplibregl.removeProtocol('gsi-dem');};
 },[]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready)return;
  if(props.view.basemap==='photo'&&!m.getSource('aerial')){
   m.addSource('aerial',{type:'raster',tiles:['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],tileSize:256,minzoom:2,maxzoom:18,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院 全国最新写真</a> · Landsat8 (GSI,TSIC,GEO Grid/AIST; USGS), GEBCO · NASA LP DAAC/USGS EROS'});
   const before=m.getStyle().layers.find(l=>l.id!=='background'&&l.id!=='base')?.id;
   m.addLayer({id:'aerial',type:'raster',source:'aerial'},before);
  }
  if(m.getLayer('aerial'))m.setLayoutProperty('aerial','visibility',props.view.basemap==='photo'?'visible':'none');
  for(const l of layers){
   const active=props.selected.includes(l.id),data=props.datasets[l.id],alpha=(props.opacity[l.id]??65)/100;
   if(!m.getSource(l.id)&&active&&l.url){
    if(l.kind==='raster'){
     m.addSource(l.id,{type:'raster',tiles:[l.url],tileSize:256,maxzoom:17});
     m.addLayer({id:l.id,type:'raster',source:l.id,paint:{'raster-opacity':alpha}});
    }else if((l.kind==='polygon'||l.kind==='point')&&data){
     m.addSource(l.id,{type:'geojson',data});
     if(l.kind==='point')m.addLayer({id:l.id,type:'circle',source:l.id,paint:{'circle-radius':['interpolate',['linear'],['zoom'],9,3,15,7],'circle-color':l.color,'circle-stroke-width':2,'circle-stroke-color':'#ffffff','circle-opacity':alpha}});
     else if(l.id==='boundary')m.addLayer({id:l.id,type:'line',source:l.id,paint:{'line-color':l.color,'line-width':1.5,'line-dasharray':[3,2],'line-opacity':alpha}});
     else m.addLayer({id:l.id,type:'fill',source:l.id,paint:{'fill-color':['coalesce',['get','color'],l.color],'fill-opacity':alpha}});
    }else if(l.kind==='pmtiles'&&props.view.zoom>=(l.minzoom??15)){
     m.addSource(l.id,{type:'vector',url:'pmtiles://'+new URL(assetUrl(l.url),window.location.href).href,minzoom:l.minzoom??0});
     m.addLayer({id:l.id,type:'line',source:l.id,'source-layer':l.sourceLayer??l.id,minzoom:l.minzoom??15,paint:{'line-color':l.color,'line-opacity':alpha}});
    }
   }
   if(m.getLayer(l.id)){
    m.setLayoutProperty(l.id,'visibility',active?'visible':'none');
    const type=m.getLayer(l.id)?.type;
    m.setPaintProperty(l.id,`${type}-opacity`,alpha);
    if(data&&(l.kind==='point'||l.kind==='polygon'))(m.getSource(l.id) as GeoJSONSource).setData(data);
   }
  }
  // Always keep facilities and the administrative outline above filled hazard areas.
  for(const id of ['landslide-special','boundary','emergency','shelter'])if(m.getLayer(id))m.moveLayer(id);
 },[ready,props.selected,props.opacity,props.datasets,props.view.zoom,props.view.basemap]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready)return;
  if(props.view.terrain){
   if(!m.getSource('terrain-dem'))m.addSource('terrain-dem',{type:'raster-dem',tiles:['gsi-dem://{z}/{x}/{y}'],tileSize:256,minzoom:1,maxzoom:14,encoding:'mapbox',attribution:'<a href="https://maps.gsi.go.jp/development/demtile.html" target="_blank">地形：国土地理院 DEM10B（表示用変換）</a>'});
   m.setTerrain({source:'terrain-dem',exaggeration:1});m.easeTo({pitch:60,duration:600});
  }else{m.setTerrain(null);if(m.getPitch()!==0||m.getBearing()!==0)m.easeTo({pitch:0,bearing:0,duration:400});if(m.getSource('terrain-dem'))m.removeSource('terrain-dem');}
 },[ready,props.view.terrain]);
 useEffect(()=>{if(ready&&props.destination)map.current?.jumpTo({center:[props.destination.lng,props.destination.lat],zoom:props.destination.zoom});},[ready,props.destination]);
 useEffect(()=>{
  if(!map.current||!ready)return;marker.current?.remove();
  if(props.point)marker.current=new maplibregl.Marker({color:'#163f47'}).setLngLat(props.point).addTo(map.current);
 },[ready,props.point]);
 return <><div ref={container} className="map-canvas" data-testid="map" aria-label="上島町の防災地図"/>{fatal&&<div className="map-fatal" role="alert">地図を開始できません。WebGL対応ブラウザを使用してください。出典と座標入力は引き続き利用できます。</div>}</>;
}
