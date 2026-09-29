'use client';
import {useEffect,useRef,useState} from 'react';
import maplibregl, {type Map as MapInstance, type GeoJSONSource} from 'maplibre-gl';
import {Protocol} from 'pmtiles';
import type {FeatureCollection,LineString} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import {assetUrl} from '@/lib/asset-url';
import {layers} from '@/lib/registry';
import {terrainProtocol,coverageProtocol} from '@/lib/terrain-protocol';
import {performanceMode,tilePixel,type TwinSettings} from '@/lib/digital-twin';
import {initialView} from '@/lib/url-state';
import {illustrativeDepth} from '@/lib/water-depth';
import RasterFallback from './RasterFallback';
import type {ViewState} from '@/lib/types';
export interface MapProps {
 twin:TwinSettings;accuracy:{lng:number;lat:number;meters:number}|null;onBuilding:(properties:Record<string,unknown>|null)=>void;onTerrainFallback:()=>void;
 view:ViewState; selected:string[]; opacity:Record<string,number>; datasets:Record<string,FeatureCollection>; walking:FeatureCollection<LineString>|null;
 destination:{lng:number;lat:number;zoom:number;sequence:number}|null; point:[number,number]|null;
 onSelect:(p:[number,number])=>void; onMove:(v:{lng:number;lat:number;zoom:number})=>void;
 onError:(id:string)=>void; onReady:()=>void; onTerrainMissing:()=>void; onTerrainFailure:()=>void;
 onParcel:(properties:Record<string,unknown>|null)=>void;
}
export default function MapView(props:MapProps){
 const container=useRef<HTMLDivElement>(null),map=useRef<MapInstance|null>(null),marker=useRef<maplibregl.Marker|null>(null);
 const callbacks=useRef(props);const [ready,setReady]=useState(false);const [fatal,setFatal]=useState(false);const [debugText,setDebugText]=useState('');
 useEffect(()=>{callbacks.current=props;},[props]);
 useEffect(()=>{
  if(!container.current)return;
  const protocol=new Protocol();maplibregl.addProtocol('pmtiles',protocol.tile);
  maplibregl.addProtocol('gsi-dem',terrainProtocol(()=>callbacks.current.onTerrainMissing(),()=>callbacks.current.onTerrainFallback()));
  maplibregl.addProtocol('gsi-coverage',coverageProtocol());
  let m:MapInstance;
  try{
   m=new maplibregl.Map({container:container.current,center:[callbacks.current.view.lng,callbacks.current.view.lat],zoom:callbacks.current.view.zoom,maxZoom:19,minZoom:2,maxPitch:80,attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true},style:{version:8,sources:{base:{type:'raster',tiles:['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],tileSize:256,maxzoom:18,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#e3eceb'}},{id:'base',type:'raster',source:'base',paint:{'raster-saturation':-0.35}}]}});
  }catch{setFatal(true);callbacks.current.onTerrainFailure();callbacks.current.onReady();return;}
  map.current=m;
  m.on('webglcontextlost',()=>{setReady(false);setFatal(true);callbacks.current.onTerrainFailure();callbacks.current.onReady();});
  m.addControl(new maplibregl.NavigationControl({showCompass:true,visualizePitch:true}),'top-right');
  m.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
  m.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
  let dragged=false,drag:{x:number;y:number;bearing:number;pitch:number;shift:boolean}|null=null;
  const canvas=m.getCanvas();
  const down=(e:PointerEvent)=>{if(e.pointerType==='mouse'&&e.button===0&&callbacks.current.view.terrain){drag={x:e.clientX,y:e.clientY,bearing:m.getBearing(),pitch:m.getPitch(),shift:e.shiftKey};dragged=false;canvas.setPointerCapture(e.pointerId);}};
  const move=(e:PointerEvent)=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)dragged=true;if(dragged)m.jumpTo(drag.shift?{pitch:Math.max(0,Math.min(80,drag.pitch-dy*.3))}:{bearing:drag.bearing+dx*.3});};
  const up=()=>{drag=null;};canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  const home=(event:KeyboardEvent)=>{if(event.key==='Home'){event.preventDefault();m.flyTo({center:[initialView.lng,initialView.lat],zoom:initialView.zoom});}};canvas.addEventListener('keydown',home);
  m.doubleClickZoom.disable();m.on('dblclick',e=>{e.preventDefault();m.flyTo({center:e.lngLat,zoom:Math.min(18,m.getZoom()+2)});});
  m.on('click',e=>{if(dragged){dragged=false;return;}callbacks.current.onSelect([e.lngLat.lng,e.lngLat.lat]);const features=m.getLayer('cadastral')?m.queryRenderedFeatures([[e.point.x-3,e.point.y-3],[e.point.x+3,e.point.y+3]],{layers:['cadastral']}):[];callbacks.current.onParcel(features[0]?.properties??null);const buildingLayers=['buildings-3d','buildings-flat'].filter(id=>m.getLayer(id));callbacks.current.onBuilding(buildingLayers.length?m.queryRenderedFeatures(e.point,{layers:buildingLayers})[0]?.properties??null:null);});
  m.on('moveend',()=>{const c=m.getCenter();callbacks.current.onMove({lng:c.lng,lat:c.lat,zoom:m.getZoom()});});
  m.on('error',e=>{const id=(e as typeof e & {sourceId?:string}).sourceId??'map';callbacks.current.onError(id);if(id==='terrain-dem')callbacks.current.onTerrainFailure();});
  m.on('style.load',()=>{setReady(true);callbacks.current.onReady();});
  const resize=new ResizeObserver(()=>m.resize());resize.observe(container.current);
  const printResize=()=>m.resize();window.addEventListener('beforeprint',printResize);window.addEventListener('afterprint',printResize);
  return()=>{resize.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('keydown',home);window.removeEventListener('beforeprint',printResize);window.removeEventListener('afterprint',printResize);marker.current?.remove();m.remove();maplibregl.removeProtocol('pmtiles');maplibregl.removeProtocol('gsi-dem');maplibregl.removeProtocol('gsi-coverage');};
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
  if(!m.getSource('walking-reach')){
   m.addSource('walking-reach',{type:'geojson',data:{type:'FeatureCollection',features:[]},attribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>'});
   m.addLayer({id:'walking-reach-halo',type:'line',source:'walking-reach',paint:{'line-color':'#ffffff','line-width':10,'line-opacity':0.95}});
   m.addLayer({id:'walking-reach',type:'line',source:'walking-reach',paint:{'line-color':'#b34a23','line-width':6,'line-opacity':0.95}});
  }
  (m.getSource('walking-reach') as GeoJSONSource).setData(props.walking??{type:'FeatureCollection',features:[]});
  m.moveLayer('walking-reach-halo');m.moveLayer('walking-reach');
 },[ready,props.walking,props.selected,props.datasets]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready)return;
  if(props.view.terrain){
   if(!m.getSource('terrain-dem'))m.addSource('terrain-dem',{type:'raster-dem',tiles:['gsi-dem://{z}/{x}/{y}'],tileSize:256,minzoom:1,maxzoom:performanceMode(callbacks.current.twin.performance)?15:17,encoding:'mapbox',attribution:'<a href="https://maps.gsi.go.jp/development/demtile.html" target="_blank">地形：国土地理院 DEM1A/5/10（表示用加工）</a>'});
   m.setTerrain({source:'terrain-dem',exaggeration:callbacks.current.twin.exaggeration});m.easeTo({pitch:55,duration:600});m.dragPan.disable();
  }else{m.setTerrain(null);m.dragPan.enable();if(m.getPitch()!==0||m.getBearing()!==0)m.easeTo({pitch:0,bearing:0,duration:400});if(m.getSource('terrain-dem'))m.removeSource('terrain-dem');}
 },[ready,props.view.terrain]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready||!props.view.terrain)return;
  const source=m.getSource('terrain-dem');if(!source)return;
  const spec=source.serialize();const maxzoom=performanceMode(props.twin.performance)?15:17;
  if('maxzoom' in spec&&spec.maxzoom!==maxzoom){m.setTerrain(null);m.removeSource('terrain-dem');m.addSource('terrain-dem',{...spec,maxzoom} as maplibregl.RasterDEMSourceSpecification);}
  m.setTerrain({source:'terrain-dem',exaggeration:props.twin.exaggeration});
 },[ready,props.view.terrain,props.twin.exaggeration,props.twin.performance]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready||!props.view.terrain)return;
  m.easeTo({pitch:props.twin.camera==='top'?0:props.twin.camera==='ground'?78:55,zoom:props.twin.camera==='ground'?Math.max(17,m.getZoom()):m.getZoom(),duration:700});
 },[ready,props.view.terrain,props.twin.camera,props.twin.cameraSequence]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready||!props.view.terrain||!props.twin.autoRotate)return;
  let frame=0,last=0;let pausedUntil=0;const pause=()=>{pausedUntil=performance.now()+3000;};m.on('mousedown',pause);m.on('touchstart',pause);m.on('wheel',pause);
  const tick=(now:number)=>{if(last&&now>pausedUntil&&!document.hidden)m.setBearing(m.getBearing()+Math.min(50,now-last)*.003);last=now;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);m.off('mousedown',pause);m.off('touchstart',pause);m.off('wheel',pause);};
 },[ready,props.view.terrain,props.twin.autoRotate]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready)return;
  const lights={morning:{color:'#fff1d4',position:[1.4,70,65] as [number,number,number],intensity:.45},day:{color:'#ffffff',position:[1.5,180,35] as [number,number,number],intensity:.5},sunset:{color:'#ffcf9f',position:[1.3,270,75] as [number,number,number],intensity:.5},night:{color:'#c4d8f6',position:[1.5,210,25] as [number,number,number],intensity:.3}};
  m.setLight({...lights[props.twin.light],anchor:'map'});
 },[ready,props.twin.light]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready)return;const fast=performanceMode(props.twin.performance);
  for(const id of ['buildings','vegetation'] as const){
   const enabled=props.twin[id];
   if(enabled&&props.view.zoom>=(id==='buildings'?12:11)&&!m.getSource(id)){
    m.addSource(id,{type:'vector',url:'pmtiles://'+new URL(assetUrl(`/data/${id}.pmtiles`),window.location.href).href,attribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>'});
    m.addLayer({id:`${id}-flat`,type:'fill',source:id,'source-layer':id,paint:{'fill-color':id==='buildings'?'#bbad92':'#60946f','fill-opacity':id==='buildings'?.65:.2}});
    m.addLayer({id:`${id}-3d`,type:'fill-extrusion',source:id,'source-layer':id,minzoom:id==='buildings'?14:13,paint:{'fill-extrusion-height':['get','height'],'fill-extrusion-color':id==='buildings'?'#d7c5a2':'#517e5a','fill-extrusion-opacity':id==='buildings'?.85:.3,'fill-extrusion-vertical-gradient':true}});
   }
   if(m.getLayer(`${id}-flat`)){const close=props.view.zoom>=(id==='buildings'?(fast?15:14):(fast?15:13));m.setLayoutProperty(`${id}-flat`,'visibility',enabled&&(!props.view.terrain||!close)?'visible':'none');m.setLayoutProperty(`${id}-3d`,'visibility',enabled&&props.view.terrain&&close?'visible':'none');}
  }
  if(props.twin.coverage&&!m.getSource('dem-coverage')){m.addSource('dem-coverage',{type:'raster',tiles:['gsi-coverage://{z}/{x}/{y}'],tileSize:256,minzoom:10,maxzoom:17});m.addLayer({id:'dem-coverage',type:'raster',source:'dem-coverage',paint:{'raster-opacity':.8,'raster-resampling':'nearest'}});}
  if(m.getLayer('dem-coverage'))m.setLayoutProperty('dem-coverage','visibility',props.twin.coverage?'visible':'none');
  m.showTileBoundaries=props.twin.debug;
 },[ready,props.twin,props.view.zoom,props.view.terrain]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready)return;const active=props.twin.water&&props.view.terrain&&props.selected.includes('tsunami');
  if(active&&props.datasets.tsunami&&!m.getSource('tsunami-volume')){
   const data={...props.datasets.tsunami,features:props.datasets.tsunami.features.map(f=>({...f,properties:{...f.properties,visualDepth:illustrativeDepth(String(f.properties?.sourceDepthClass??''))}})).filter(f=>f.properties.visualDepth!==null)};
   m.addSource('tsunami-volume',{type:'geojson',data});m.addLayer({id:'tsunami-volume',type:'fill-extrusion',source:'tsunami-volume',paint:{'fill-extrusion-color':'#348ec0','fill-extrusion-height':['get','visualDepth'],'fill-extrusion-opacity':.42}});
  }
  if(m.getLayer('tsunami-volume'))m.setLayoutProperty('tsunami-volume','visibility',active?'visible':'none');
 },[ready,props.twin.water,props.view.terrain,props.selected,props.datasets]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready)return;const p=props.accuracy;
  const coordinates=p?Array.from({length:65},(_,i)=>{const angle=i/64*Math.PI*2;return [p.lng+Math.cos(angle)*p.meters/(111320*Math.cos(p.lat*Math.PI/180)),p.lat+Math.sin(angle)*p.meters/111320];}):[];
  const data:FeatureCollection={type:'FeatureCollection',features:p?[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[coordinates]}}]:[]};
  if(!m.getSource('location-accuracy')){m.addSource('location-accuracy',{type:'geojson',data});m.addLayer({id:'location-accuracy',type:'fill',source:'location-accuracy',paint:{'fill-color':'#1874ae','fill-opacity':.15,'fill-outline-color':'#1874ae'}});}else (m.getSource('location-accuracy') as GeoJSONSource).setData(data);
 },[ready,props.accuracy]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready||!props.twin.debug)return;let frames=0;const render=()=>frames++;m.on('render',render);
  const timer=setInterval(()=>{const mem=(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory;const c=m.getCenter();setDebugText(`WebGL2 · WebGPU ${'gpu' in navigator?'検出':'未検出'} · ${frames} FPS（静止時0） · Heap ${mem?`${Math.round(mem.usedJSHeapSize/1048576)} MB`:'未対応'} · Terrain LOD ≤${performanceMode(callbacks.current.twin.performance)?15:17} · z17 ${tilePixel(c.lng,c.lat,17).key}`);frames=0;},1000);
  return()=>{clearInterval(timer);m.off('render',render);};
 },[ready,props.twin.debug]);
 useEffect(()=>{if(ready&&props.destination){const opts={center:[props.destination.lng,props.destination.lat] as [number,number],zoom:props.destination.zoom};if(props.view.terrain)map.current?.flyTo({...opts,duration:900});else map.current?.jumpTo(opts);}},[ready,props.destination,props.view.terrain]);
 useEffect(()=>{
  if(!map.current||!ready)return;marker.current?.remove();
  if(props.point)marker.current=new maplibregl.Marker({color:'#163f47'}).setLngLat(props.point).addTo(map.current);
 },[ready,props.point]);
 return <><div ref={container} className="map-canvas" style={fatal?{display:'none'}:undefined} data-testid="map" aria-label="上島町の防災地図"/>{props.twin.debug&&<output className="terrain-debug">{debugText||'描画情報を取得中…'}</output>}{fatal&&<RasterFallback {...props}/>}</>;
}
