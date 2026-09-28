'use client';
/* eslint-disable @next/next/no-img-element */
import dynamic from 'next/dynamic';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {FeatureCollection} from 'geojson';
import {layers,categories,scenarios} from '@/lib/registry';
import {analyse,nearest,overlapCount,stateLabels} from '@/lib/analysis';
import {initialView,parseState,serializeState} from '@/lib/url-state';
import {assetUrl} from '@/lib/asset-url';
import {elevationAt} from '@/lib/elevation';
import type {Area,Facilities,HazardResult,Layer,ViewState} from '@/lib/types';
const Map=dynamic(()=>import('./Map'),{ssr:false,loading:()=> <div className="map-loading">地図を準備しています…</div>});
const emptyFacilities:Facilities={type:'FeatureCollection',features:[]};
const disasterNames=['洪水','崖崩れ・土石流・地滑り','高潮','地震','津波','大規模な火事','内水氾濫','火山現象'];
type Parcel={id:number;district:string;area:string;parcel:string;lng:number;lat:number};
function Legend({layer}:{layer:Layer}){return <div className="legend">{layer.legendUrl?<><img src={layer.legendUrl} alt={`${layer.title}の原典凡例（浸水深）`} loading="lazy"/><a href={layer.sourceUrl} target="_blank" rel="noreferrer">原典の凡例を確認 ↗</a></>:layer.legend.map(x=><span key={x.label}><i style={{background:x.color}}/>{x.label}</span>)}</div>;}
export default function GIS(){
 const [view,setView]=useState<ViewState>(initialView),[initialized,setInitialized]=useState(false),[mapReady,setMapReady]=useState(false);
 const [datasets,setDatasets]=useState<Record<string,FeatureCollection>>({}),[loading,setLoading]=useState<string[]>([]),[errors,setErrors]=useState<string[]>([]);
 const requested=useRef(new Set<string>());
 const [terrainMissing,setTerrainMissing]=useState(false);
 const terrainFailure=useCallback(()=>{setView(old=>({...old,terrain:false}));setNotice('地形データを取得できないため2D表示に戻しました。');},[]);
 const [opacity,setOpacity]=useState<Record<string,number>>({boundary:100,emergency:100,shelter:100});
 const [selectedPoint,setSelectedPoint]=useState<[number,number]|null>(null),[elevation,setElevation]=useState<string>('未選択');
 const [destination,setDestination]=useState<{lng:number;lat:number;zoom:number;sequence:number}|null>(null);
 const [panel,setPanel]=useState<'layers'|'details'|null>(null),[source,setSource]=useState<string|null>(null),[notice,setNotice]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),[query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false);
 const [coordinate,setCoordinate]=useState({lat:'34.257',lng:'133.204'});
 const [printOrientation,setPrintOrientation]=useState('landscape');
 const [searchMode,setSearchMode]=useState('facility'),[parcelIndex,setParcelIndex]=useState<Parcel[]|null>(null),[parcelLoading,setParcelLoading]=useState(false),[selectedParcel,setSelectedParcel]=useState<Record<string,unknown>|null>(null);
 useEffect(()=>{if(searchMode!=='parcel'||parcelIndex)return;const c=new AbortController();setParcelLoading(true);fetch(assetUrl('/data/parcel-search.json'),{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setParcelIndex).catch(()=>{if(!c.signal.aborted)setNotice('地番索引を取得できません。検索種別を切り替えて再試行してください。');}).finally(()=>setParcelLoading(false));return()=>c.abort();},[searchMode,parcelIndex]);
 const parcelResults=useMemo(()=>{const tokens=query.trim().normalize('NFKC').split(/\s+/).filter(Boolean);return tokens.length?(parcelIndex??[]).filter(p=>tokens.every(t=>`${p.district} ${p.area} ${p.parcel}`.normalize('NFKC').includes(t))).slice(0,15):[];},[query,parcelIndex]);
 const onError=useCallback((id:string)=>{setErrors(old=>old.includes(id)?old:[...old,id]);},[]);
 useEffect(()=>{setView(parseState(window.location.hash.slice(1)||window.location.search));setInitialized(true);
  const restore=()=>{const state=parseState(window.location.hash.slice(1));setView(state);setDestination({...state,sequence:Date.now()});};
  window.addEventListener('hashchange',restore);return()=>window.removeEventListener('hashchange',restore);
 },[]);
 const load=useCallback(async(id:string)=>{
  const l=layers.find(x=>x.id===id);if(!l?.url||!['point','polygon'].includes(l.kind)||requested.current.has(id))return;
  requested.current.add(id);setLoading(old=>[...old,id]);
  try{const r=await fetch(assetUrl(l.url),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('data unavailable');const data=await r.json();if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('invalid data');setDatasets(old=>({...old,[id]:data}));}
  catch{onError(id);}finally{setLoading(old=>old.filter(x=>x!==id));}
 },[onError]);
 useEffect(()=>{if(!initialized)return;for(const id of new Set([...view.layers,'boundary','emergency','shelter',...(selectedPoint?layers.filter(l=>l.hazardKind&&l.kind==='polygon').map(l=>l.id):[])]))void load(id);},[initialized,view.layers,selectedPoint,load]);
 useEffect(()=>{
  if(!selectedPoint)return;
  const c=new AbortController();let current=true;setElevation('取得中…');
  const timer=setTimeout(()=>c.abort(),10000);
  elevationAt(...selectedPoint,c.signal).then(v=>{if(current&&!c.signal.aborted)setElevation(v===null?'NO_DATA（標高データなし）':`${v.toFixed(1)} m`);}).catch(()=>{if(current)setElevation('NO_DATA（取得できません）');}).finally(()=>clearTimeout(timer));
  return()=>{current=false;clearTimeout(timer);c.abort();};
 },[selectedPoint]);
 useEffect(()=>{if(source)dialog.current?.showModal();else dialog.current?.close();},[source]);
 useEffect(()=>{if(panel!=='layers')return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setPanel(null);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[panel]);
 const selectPoint=useCallback((p:[number,number])=>{setSelectedParcel(null);setSelectedPoint(p);setCoordinate({lat:p[1].toFixed(6),lng:p[0].toFixed(6)});setPanel('details');},[]);
 const onMove=useCallback((v:{lng:number;lat:number;zoom:number})=>setView(old=>({...old,...v})),[]);
 const moveTo=(lng:number,lat:number,zoom=15)=>{setView(old=>({...old,lng,lat,zoom}));setDestination({lng,lat,zoom,sequence:Date.now()});};
 const results=useMemo<Record<string,HazardResult>>(()=>Object.fromEntries(layers.filter(l=>l.hazardKind).map(l=>[l.id,selectedPoint?analyse(l,selectedPoint,datasets[l.id] as Area|undefined,datasets.boundary as Area|undefined,loading.includes(l.id)):{state:'NOT_CHECKED' as const,reason:'地図または座標入力で地点を選択してください。',matches:0}])),[selectedPoint,datasets,loading]);
 const count=overlapCount(results,layers),known=Object.values(results).filter(r=>r.state==='APPLICABLE'||r.state==='NOT_APPLICABLE').length;
 const nearby=selectedPoint?nearest(selectedPoint,(datasets.emergency as Facilities)??emptyFacilities):[];
 const nearbyShelters=selectedPoint?nearest(selectedPoint,(datasets.shelter as Facilities)??emptyFacilities,2):[];
 const searchResults=useMemo(()=>{
  const q=query.trim().normalize('NFKC');if(!q)return [];
  return ['emergency','shelter'].flatMap(id=>((datasets[id] as Facilities)?.features??[]).map(f=>({id,feature:f}))).filter(({feature:f})=>`${f.properties?.name} ${f.properties?.address}`.normalize('NFKC').includes(q)).slice(0,12);
 },[query,datasets]);
 const toggle=(id:string)=>setView(old=>({...old,scenario:'custom',layers:old.layers.includes(id)?old.layers.filter(x=>x!==id):[...old.layers,id]}));
 const geolocate=()=>{
  if(!window.isSecureContext){setNotice('LANのHTTP接続では現在地を利用できません。地図クリック・座標入力・施設検索をご利用ください。');return;}
  if(!navigator.geolocation){setNotice('このブラウザでは現在地を取得できません。');return;}
  setNotice('ブラウザの位置情報許可を確認しています…');
  navigator.geolocation.getCurrentPosition(p=>{moveTo(p.coords.longitude,p.coords.latitude);selectPoint([p.coords.longitude,p.coords.latitude]);setNotice(`現在地を表示しました（精度 約${Math.round(p.coords.accuracy)}m）。位置は永続保存しません。`);},()=>setNotice('現在地を取得できません。許可設定を確認するか、地図・座標で地点を選んでください。'),{timeout:12000,maximumAge:0,enableHighAccuracy:false});
 };
 const share=async()=>{
  const url=new URL(window.location.href);url.search='';url.hash=serializeState(view);
  try{await navigator.clipboard.writeText(url.href);window.history.replaceState(null,'',url.href);setNotice('表示範囲・レイヤーの共有URLをコピーしました。');}catch{window.history.replaceState(null,'',url.href);setNotice('アドレス欄に共有URLを設定しました。コピーしてください。');}
 };
 const retry=()=>{for(const id of errors){requested.current.delete(id);void load(id);}setErrors([]);setNotice('データを再読み込みしています。タイルの再取得は地図を移動してください。');};
 const activeLayers=layers.filter(l=>view.layers.includes(l.id)),sourceLayers=source==='all'?layers:layers.filter(l=>l.id===source);
 return <main className="app-shell">
  <a className="skip-link" href="#coordinate-form">座標入力で地点を調べる</a>
  <header className="header">
   <div className="brand"><span className="brand-mark" aria-hidden="true">≋</span><div><p>KAMIJIMA · DISASTER GIS</p><h1>上島町 <span>統合防災WebGIS</span></h1></div><span className="version">参考版</span></div>
   <div className="header-actions"><button onClick={()=>setSource('all')}>ⓘ データ・出典</button><button onClick={()=>setSource('disclaimer')}>利用上の注意</button></div>
  </header>
  <section className="toolbar" aria-label="地図の操作">
   <div className="search"><label className="sr-only" htmlFor="search">地名・施設・地番を検索</label><select className="search-mode" aria-label="検索種別" value={searchMode} onChange={e=>{setSearchMode(e.target.value);setSearchOpen(true);}}><option value="facility">地名・施設</option><option value="parcel">地番</option></select><input id="search" placeholder={searchMode==='parcel'?'例：生名 1218-1':'地名・避難施設を検索'} value={query} onChange={e=>{setQuery(e.target.value);setSearchOpen(true);}} onFocus={()=>setSearchOpen(true)} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);}}/>
    {searchOpen&&query&&<div className="search-results">{searchMode==='facility'?<><p>公開施設の名称・住所を検索</p>{searchResults.length?searchResults.map(({id,feature:f},i)=><button key={`${id}-${i}`} onClick={()=>{const [lng,lat]=f.geometry.coordinates;moveTo(lng,lat);selectPoint([lng,lat]);setSearchOpen(false);}}><strong>{String(f.properties?.name)}</strong><small>{id==='emergency'?'指定緊急避難場所':'指定避難所'} · {String(f.properties?.address)}</small></button>):<p>一致する施設はありません。</p>}</>:<><p>公開地籍図上の位置（推定座標系・参考）</p>{parcelLoading?<p>地番索引を読み込み中…</p>:parcelResults.length?parcelResults.map(p=><button key={p.id} onClick={()=>{setView(old=>({...old,layers:[...new Set([...old.layers,'cadastral'])]}));moveTo(p.lng,p.lat,17);selectPoint([p.lng,p.lat]);setSelectedParcel(p);setSearchOpen(false);}}><strong>{p.district} / {p.area} {p.parcel}</strong><small>座標系は第IV系と推定。筆界・権利の証明には使えません。</small></button>):<p>一致する地番はありません。地区・字・地番を空白で区切れます。</p>}</>}<button onClick={()=>setSearchOpen(false)}>検索結果を閉じる</button></div>}
   </div>
   <label className="scenario"><span>表示プリセット</span><select aria-label="表示プリセット" value={view.scenario} onChange={e=>{const scenario=e.target.value;setView(old=>({...old,scenario,layers:scenarios[scenario].layers}));}}>{Object.entries(scenarios).map(([id,s])=><option value={id} key={id}>{s.title}</option>)}</select></label>
   <div className="tools"><button onClick={geolocate}>◎ 現在地</button><button onClick={()=>void share()}>↗ 共有</button><button onClick={()=>setSource('print')}>▤ 印刷</button></div>
  </section>
  <div className="workspace">
   <aside id="layer-panel" className={`layer-panel ${panel==='layers'?'floating-open':''}`} aria-label="レイヤー" aria-hidden={panel!=='layers'}>
    <div className="panel-heading"><div><p className="eyebrow">MAP LAYERS</p><h2>レイヤーを選ぶ</h2></div><span className="counter" aria-label={`選択中 ${view.layers.length}件`}>{view.layers.length}</span><button className="mobile-close" aria-label="レイヤーを閉じる" onClick={()=>setPanel(null)}>閉じる ×</button></div>
    <p className="panel-intro">選んだ情報はすぐ地図に反映されます。</p>
    <div className="layer-scroll"><fieldset className="basemap-controls"><legend>背景地図</legend><label><input type="radio" name="basemap" checked={view.basemap==='map'} onChange={()=>setView(old=>({...old,basemap:'map'}))}/>淡色地図</label><label><input type="radio" name="basemap" checked={view.basemap==='photo'} onChange={()=>setView(old=>({...old,basemap:'photo'}))}/>航空写真</label>{view.basemap==='photo'&&<p>広域では衛星画像、ズーム14以上では航空写真等を表示。撮影時期は場所により異なります。<a href="https://maps.gsi.go.jp/legend/seamlessphoto.pdf" target="_blank" rel="noreferrer">写真の出典・撮影時期について ↗</a></p>}</fieldset>
    <details className="terrain-settings"><summary>3D地形の使い方・出典</summary><p>国土地理院DEM10B、地形の高さは実寸（強調1倍）。右ドラッグ／Ctrl＋ドラッグ、タッチでは2本指で傾き・方位を変更できます。建物モデルは含みません。</p><p>欠測部分は描画上0mに補完します。地点の標高判定には補完値を使用しません。{terrainMissing&&'現在の表示に欠測部分を含みます。'}</p><a href="https://maps.gsi.go.jp/development/demtile.html" target="_blank" rel="noreferrer">DEM仕様・出典 ↗</a></details>
    {Object.entries(categories).map(([category,title])=><details key={category} open className="category"><summary>{title}<span>{layers.filter(l=>l.category===category).length}</span></summary>{layers.filter(l=>l.category===category).map(l=><div className={`layer-item ${view.layers.includes(l.id)?'selected':''}`} key={l.id}>
     <div className="layer-row"><label><input type="checkbox" checked={view.layers.includes(l.id)} onChange={()=>toggle(l.id)} aria-label={l.title}/><span>{l.title}</span></label><button className="info-button" aria-label={`${l.title}の出典`} onClick={()=>setSource(l.id)}>i</button></div>
     <div className="layer-meta"><span className={l.status==='DATA_SOURCE_PENDING'?'pending':'status'}>{l.status==='DATA_SOURCE_PENDING'?'確認待ち':l.status==='DISPLAY_ONLY'?'画像表示':'取得済み'}</span><span>基準日 {l.effectiveDate??(l.category==='LANDSLIDE'?'区域別告示日':'未確認')}</span></div>
     {view.layers.includes(l.id)&&<div className="layer-controls">{l.id==='flood'&&<p className="data-gap">上島町の洪水は配信タイル・国土数値情報2025年度版で収録を確認できません。<a href="https://www.pref.ehime.jp/site/kouzuishinsusoutei/141959.html" target="_blank" rel="noreferrer">県の2026年公表図を確認 ↗</a></p>}{l.id==='surge'&&<p className="data-gap">上島町付近の配信タイルは未取得（404）。国土数値情報の高潮データにも愛媛県の掲載を確認できません。空白を区域外とは判定しません。</p>}{l.id==='tsunami'&&<p className="data-gap">国土数値情報2016年度版。最新県想定との時点差に注意。凡例は原典区分・本アプリ配色です。</p>}{l.id==='cadastral'&&<p className="cadastral-note">{view.zoom<15?'ズーム15以上で表示します。':'座標系を推定した参考表示。'} JGD2000 / JGD2011は未確定。</p>}{l.kind==='pending'?<p className="data-gap">DATA_SOURCE_PENDING<br/>{l.id==='cadastral'?'原典の座標系を確認中です。':'利用条件を確認中です。'}</p>:<><label className="opacity">不透明度 <input aria-label={`${l.title}の不透明度`} type="range" min="0" max="100" value={opacity[l.id]??65} onChange={e=>setOpacity(old=>({...old,[l.id]:Number(e.target.value)}))}/><output>{opacity[l.id]??65}%</output></label><Legend layer={l}/></>}{errors.includes(l.id)&&<p role="status" className="data-gap">現在このデータを表示できません。一部タイルが未収録の場合もあります。</p>}</div>}
    </div>)}</details>)}</div>
    {errors.length>0&&<div className="layer-footer"><details><summary>一部データを表示できません（{errors.length}件）</summary><p>{errors.map(id=>layers.find(l=>l.id===id)?.title??(id==='aerial'?'航空写真':id==='terrain-dem'?'3D地形':'背景地図')).join('・')}</p><button onClick={retry}>再試行</button></details></div>}
   </aside>
   <section className="map-region" aria-label="地図と表示状態">
    {initialized&&<Map view={view} selected={view.layers} opacity={opacity} datasets={datasets} destination={destination} point={selectedPoint} onSelect={selectPoint} onParcel={setSelectedParcel} onMove={onMove} onError={onError} onReady={()=>setMapReady(true)} onTerrainMissing={()=>setTerrainMissing(true)} onTerrainFailure={terrainFailure}/>}
    <div className="map-top-actions"><button className="layers-trigger" aria-controls="layer-panel" aria-expanded={panel==='layers'} onClick={()=>setPanel(panel==='layers'?null:'layers')}>☷ レイヤーを選ぶ <b>{view.layers.length}</b></button><button onClick={()=>moveTo(initialView.lng,initialView.lat,initialView.zoom)}>⌖ 町全域</button><button onClick={()=>selectPoint([view.lng,view.lat])}>＋ 地点判定（中央）</button><button aria-pressed={view.terrain} onClick={()=>{setTerrainMissing(false);setView(old=>({...old,terrain:!old.terrain}));}}>{view.terrain?'2Dに戻す':'3D地形'}</button></div>
    <div className="mobile-tabs"><button aria-expanded={panel==='layers'} onClick={()=>setPanel(panel==='layers'?null:'layers')}>☷ レイヤー <b>{view.layers.length}</b></button><button aria-expanded={panel==='details'} onClick={()=>setPanel(panel==='details'?null:'details')}>⌖ 地点情報</button></div>
   </section>
   <aside className={`detail-panel ${panel==='details'?'mobile-open':''}`} aria-label="この場所の防災情報">
    <div className="panel-heading"><div><p className="eyebrow">POINT INFORMATION</p><h2>地点判定・防災情報</h2></div><button className="mobile-close" onClick={()=>setPanel(null)}>閉じる</button></div>
    <div className="detail-scroll">
     <form id="coordinate-form" className="coordinate-form" onSubmit={e=>{e.preventDefault();const lat=Number(coordinate.lat),lng=Number(coordinate.lng);if(!coordinate.lat.trim()||!coordinate.lng.trim()||!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -85||lat>85||lng< -180||lng>180){setNotice('緯度・経度を有効な数値で入力してください。');return;}moveTo(lng,lat,Math.max(13,view.zoom));selectPoint([lng,lat]);}}>
      <p>地図を選択、または緯度・経度を入力。非表示の災害区域も判定します。</p><div><label>緯度<input required aria-label="緯度" type="number" step="any" min="-85" max="85" value={coordinate.lat} onChange={e=>setCoordinate(old=>({...old,lat:e.target.value}))}/></label><label>経度<input required aria-label="経度" type="number" step="any" min="-180" max="180" value={coordinate.lng} onChange={e=>setCoordinate(old=>({...old,lng:e.target.value}))}/></label></div><button type="submit">この地点を調べる →</button>
     </form>
     {!selectedPoint?<div className="empty-detail"><div aria-hidden="true">⌖</div><h3>知ることから、備えよう。</h3><p>選んだ地点の想定区域・標高・周辺の避難施設をまとめて確認できます。</p><div className="empty-chips"><span>水害</span><span>地震</span><span>土砂災害</span></div></div>:<>
      <section className="point-summary" aria-live="polite"><p className="eyebrow">選択した地点</p><button className="clear-point" onClick={()=>{setSelectedPoint(null);setSelectedParcel(null);}}>地点選択を解除</button><strong>{selectedPoint[1].toFixed(6)}, {selectedPoint[0].toFixed(6)}</strong>{selectedParcel&&<p className="parcel-selection">公開地籍図上の位置<br/>{String(selectedParcel.district)} {String(selectedParcel.area)} {String(selectedParcel.parcel)}<br/><small>座標系推定・参考表示。地点判定は筆全体の判定ではありません。</small></p>}<div className="elevation"><span>標高（参考）</span><b>{elevation}</b></div><small>国土地理院 DEM10B。海抜と浸水深は異なります。</small></section>
      <section className="overlap"><strong>{count}種類の想定区域への該当を確認</strong><p>判定できた{known}レイヤーでの結果です。未判定の情報があります。重複数は危険度ではありません。</p></section>
      <p className="analysis-capability">地点判定対応：津波（2016年度版）・土砂災害警戒区域・特別警戒区域。高潮・洪水は画像の確認のみ、震度・液状化・地盤沈下はデータ確認待ちです。</p><div className="hazard-results">{layers.filter(l=>l.hazardKind).map(l=><details key={l.id} className="hazard-result" open={results[l.id].state==='APPLICABLE'}><summary><span>{l.title}</span><b className={`state-${results[l.id].state}`}>{stateLabels[results[l.id].state]}</b></summary><p>{results[l.id].classLabel}</p><p>{results[l.id].reason}</p>{l.id==='flood'&&<p className="data-gap">上島町の洪水は配信タイル・国土数値情報2025年度版で収録を確認できません。<a href="https://www.pref.ehime.jp/site/kouzuishinsusoutei/141959.html" target="_blank" rel="noreferrer">県の2026年公表図を確認 ↗</a></p>}{l.id==='surge'&&<p className="data-gap">上島町付近の配信タイルは未取得（404）。国土数値情報の高潮データにも愛媛県の掲載を確認できません。空白を区域外とは判定しません。</p>}{l.id==='tsunami'&&<p>判定資料：国土数値情報2016年度版。最新県想定とは時点が異なります。</p>}{results[l.id].areas?.map((a,i)=><dl className="hit-area" key={i}><dt>区域名</dt><dd>{a.name}</dd><dt>現象</dt><dd>{a.phenomenon}</dd><dt>{l.id==='tsunami'?'元データ行':'区域番号'}</dt><dd>{a.areaCode}</dd>{l.id!=='tsunami'&&<><dt>告示日</dt><dd>{a.noticeDate}</dd></>}</dl>)}<code>{results[l.id].state}</code><button onClick={()=>setSource(l.id)}>出典を見る</button></details>)}</div>
      <section className="nearby"><h3>周辺の指定緊急避難場所</h3><p>直線距離順。経路・到達可否・開設状況は示しません。海を隔てた施設も含みます。</p>{nearby.map(({feature:f,km},i)=><button key={i} onClick={()=>{const [lng,lat]=f.geometry.coordinates;moveTo(lng,lat);selectPoint([lng,lat]);}}><span className="facility-symbol">↗</span><span><strong>{String(f.properties?.name)}</strong><small>{disasterNames.filter((_,n)=>Number(f.properties?.[`disaster${n+1}`])===1).join('・')||'対応災害の登録なし'}</small></span><b>{km.toFixed(2)}<small>km</small></b></button>)}{!nearby.length&&<p>施設データを取得できていません。</p>}<h3>周辺の指定避難所</h3><p>災害の危険がなくなるまで滞在する施設。緊急避難場所とは役割が異なります。</p>{nearbyShelters.map(({feature:f,km},i)=><p key={i}>{String(f.properties?.name)} · {km.toFixed(2)} km</p>)}</section>
     </>}
     <div className="safety-note"><strong>データなし ≠ 安全</strong><p>本システムは安全を保証しません。避難の判断には、町・県・気象庁等の最新情報をご確認ください。</p><button onClick={()=>setSource('disclaimer')}>利用上の注意を読む ↗</button></div>
    </div>
   </aside>
  </div>
  <footer className="footer"><span data-testid="map-status" role="status">{mapReady?'地図操作が可能です':'地図を読み込み中…'} · {view.terrain?'3D':'2D'} · ズーム {view.zoom.toFixed(1)} <span className="footer-warning"> · 未着色は安全を意味しません</span></span><span>データ確認日 2026.09.28 <button onClick={()=>setSource('all')}>出典・更新日</button></span></footer>
  {notice&&<div className="toast" role="status"><span>{notice}</span>{errors.length>0&&<button onClick={retry}>再試行</button>}<button aria-label="通知を閉じる" onClick={()=>{setNotice('');}}>×</button></div>}
  <dialog ref={dialog} onCancel={()=>setSource(null)} onClose={()=>setSource(null)} aria-labelledby="dialog-title">
   <div className="dialog-heading"><h2 id="dialog-title">{source==='disclaimer'?'利用上の注意':source==='print'?'地図を印刷':'データ・出典'}</h2><button onClick={()=>setSource(null)} aria-label="閉じる">閉じる ×</button></div>
   {source==='disclaimer'?<div className="disclaimer"><h3>安全を保証する情報ではありません</h3><p>公的な災害・地理情報を閲覧する参考システムです。上島町公式サービスではありません。想定を超える災害や、未掲載の危険があり得ます。データなし・区域外・非該当を「安全」と解釈しないでください。</p><h3>施設・地籍の注意</h3><p>指定緊急避難場所は災害種別ごとに指定されます。指定避難所とは異なります。最新の指定・開設状況は上島町へ確認してください。地籍は参考情報で、土地の境界・所有権その他の権利関係を証明しません。</p><h3>位置情報と外部通信</h3><p>現在地は「現在地」操作とブラウザの許可時のみ取得します。検索履歴・現在地をアプリで永続保存しません。地図タイル・標高の取得時は地理院等へ表示地域のタイル番号が送信されます。共有操作を行うと地図中心の座標がURLに含まれます。共有先に位置を伝えてよいか確認してください。</p><a href="https://www.town.kamijima.lg.jp/" target="_blank" rel="noreferrer">上島町公式ホームページ ↗</a></div>:source==='print'?<div><p>A4で地図・表示レイヤーの凡例・出典・基準日・免責を印刷します。地図の読み込み完了を確認してください。</p><label>用紙の向き <select value={printOrientation} onChange={e=>setPrintOrientation(e.target.value)}><option value="landscape">横</option><option value="portrait">縦</option></select></label><p>プリンター側の用紙設定もA4にしてください。</p><button className="primary" onClick={()=>{setSource(null);setTimeout(()=>window.print(),250);}}>印刷ダイアログを開く</button></div>:sourceLayers.map(l=><article className="source-card" key={l.id}><h3>{l.title}</h3><p>{l.notes}</p><dl><dt>配布元</dt><dd>{l.publisher}</dd><dt>データ基準日</dt><dd>{l.effectiveDate??'未確認（取得日・確認日とは異なります）'}</dd><dt>公開日</dt><dd>{l.publishedDate??'未確認'}</dd><dt>取得日 / 確認日</dt><dd>{l.downloadedDate??'直接配信・未取得'} / {l.checkedDate}</dd><dt>原典形式 / CRS</dt><dd>{l.originalFormat} / {l.originalCrs}</dd><dt>加工形式</dt><dd>{l.processedFormat}</dd><dt>利用条件</dt><dd>{l.license}</dd><dt>状況</dt><dd>{l.status}</dd></dl><a href={l.sourceUrl} target="_blank" rel="noreferrer">配布元の原典を見る ↗</a><Legend layer={l}/></article>)}
   {source==='all'&&<article className="source-card"><h3>背景写真・3D地形</h3><p>国土地理院 全国最新写真（シームレス）とDEM10B。確認日：2026-09-28。写真の撮影時期・DEMの測量時期は地域ごとに異なります。地理院タイル利用規約に基づく直接配信です。</p><p>DEMは表示用にTerrain-RGBへ変換し、高さ強調1倍で描画。欠測部は描画上0mで補完します。建物モデルを含みません。</p><a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル一覧・利用条件 ↗</a><br/><a href="https://maps.gsi.go.jp/development/demtile.html" target="_blank" rel="noreferrer">DEM仕様 ↗</a></article>}
  </dialog>
  <style>{`@media print { @page { size: A4 ${printOrientation}; margin: 10mm; } }`}</style>
  <section className="print-only">{view.terrain&&<p>3D地形：国土地理院 DEM10B（高さ強調1倍）。欠測部は描画上0mで補完。建物モデルなし。https://maps.gsi.go.jp/development/demtile.html</p>}<p>背景：{view.basemap==='photo'?'国土地理院 全国最新写真（シームレス）。撮影時期は場所ごとに異なります。広域画像：Landsat8 (GSI,TSIC,GEO Grid/AIST; USGS), GEBCO; NASA LP DAAC/USGS EROS':'国土地理院 淡色地図'} / https://maps.gsi.go.jp/development/ichiran.html</p><h2>表示レイヤー・凡例・出典</h2>{activeLayers.map(l=><article key={l.id}><h3>{l.title} — {l.status}</h3><Legend layer={l}/><p>{l.publisher} / 基準日 {l.effectiveDate??'未確認'} / 確認日 {l.checkedDate}</p><p>{l.sourceUrl}</p><p>{l.notes}</p></article>)}<p>本資料は安全を保証しません。区域外・未掲載・未着色は安全を意味しません。避難判断には公的機関の最新情報を確認してください。地籍は権利関係を証明しません。</p></section>
 </main>;
}
