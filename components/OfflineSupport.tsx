'use client';
import {useEffect,useState} from 'react';
import {assetUrl} from '@/lib/asset-url';
export default function OfflineSupport(){
 const [offline,setOffline]=useState(false);
 useEffect(()=>{
  const update=()=>setOffline(!navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);
  if('serviceWorker' in navigator){
   navigator.serviceWorker.register(assetUrl('/sw.js'),{scope:assetUrl('/')}).then(()=>navigator.serviceWorker.ready).then(registration=>{
    // Warm only static resources already requested by this page. No coordinates or user inputs are stored.
    const urls=performance.getEntriesByType('resource').map(entry=>entry.name).filter(url=>url.startsWith(location.origin+assetUrl('/_next/static/')));
    registration.active?.postMessage({type:'CACHE_SHELL',urls});
   }).catch(()=>{/* Offline support is optional; the online GIS remains available. */});
  }
  return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};
 },[]);
 return offline?<div className="offline-status" role="status">オフライン：保存済みの画面・タイルのみ表示できます。未保存の範囲や最新情報は取得できません。</div>:null;
}
