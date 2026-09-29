'use client';
import {useEffect,useState} from 'react';
import {loadTerrainMetadata,type TerrainMetadata,type TwinSettings,type CameraMode} from '@/lib/digital-twin';
export default function TwinPanel({value,onChange,onClose,onFly,onData}:{value:TwinSettings;onChange:(value:TwinSettings)=>void;onClose:()=>void;onFly:(lng:number,lat:number,zoom:number)=>void;onData:()=>void}){
 const [metadata,setMetadata]=useState<TerrainMetadata|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{loadTerrainMetadata().then(setMetadata).catch(()=>setFailed(true));},[]);
 const patch=(partial:Partial<TwinSettings>)=>onChange({...value,...partial});
 const camera=(mode:CameraMode)=>patch({camera:mode,cameraSequence:value.cameraSequence+1,autoRotate:false});
 return <section className="twin-panel" aria-label="KAMIJIMA 3D設定">
  <header><div><p className="eyebrow">DIGITAL TWIN</p><h2>KAMIJIMA 3D</h2></div><button onClick={onClose} aria-label="3D設定を閉じる">閉じる ×</button></header>
  <div className="twin-scroll">
   <p className="twin-intro">地形・建物・防災情報を重ねた、上島町の立体模型。</p>
   <fieldset><legend>カメラ</legend><div className="twin-segments"><button aria-pressed={value.camera==='top'} onClick={()=>camera('top')}>真上</button><button aria-pressed={value.camera==='bird'} onClick={()=>camera('bird')}>鳥瞰</button><button aria-pressed={value.camera==='ground'} onClick={()=>camera('ground')}>地表付近</button></div><label><input type="checkbox" checked={value.autoRotate} onChange={e=>patch({autoRotate:e.target.checked})}/>ゆっくり自動回転</label><small>3D：ドラッグで移動、Ctrl＋左ドラッグで回転・傾き。タッチは2本指。ダブルクリックで地点へ接近。地表付近は見下ろす視点です。</small></fieldset>
   <fieldset><legend>地形の高さ</legend><div className="twin-segments">{([1,1.5,2] as const).map(n=><button key={n} aria-pressed={value.exaggeration===n} onClick={()=>patch({exaggeration:n})}>{n.toFixed(1)}×</button>)}</div>{value.exaggeration!==1&&<p className="twin-warning">標高誇張中：{value.exaggeration}倍。地点標高は元の値です。</p>}<small>国土地理院DEM1A → DEM5A → DEM5B/C → DEM10Bの順に欠測を補完。表示用補間地形を含みます。</small></fieldset>
   <fieldset><legend>立体レイヤー</legend><label><input type="checkbox" checked={value.buildings} onChange={e=>patch({buildings:e.target.checked})}/>建物（推定高さ）</label><label><input type="checkbox" checked={value.vegetation} onChange={e=>patch({vegetation:e.target.checked})}/>森林の樹冠（模式表示）</label><label><input type="checkbox" checked={value.water} onChange={e=>patch({water:e.target.checked})}/>津波の浸水深区分を立体表示</label><small>建物はズーム14以上で立体化。高さは全4,306棟が推定値です。森林8mは表現用の仮定です。</small>{value.water&&<p className="twin-warning">公式想定区域：2016年度版。高さは浸水深区分の代表値による模式表示です。実際の水面・流体シミュレーションではありません。津波レイヤーも選択してください。</p>}</fieldset>
   <fieldset><legend>光の雰囲気</legend><select aria-label="光の雰囲気" value={value.light} onChange={e=>patch({light:e.target.value as TwinSettings['light']})}><option value="morning">朝</option><option value="day">昼</option><option value="sunset">夕方</option><option value="night">夜</option></select><small>照明の演出です。実際の日時・日影解析には対応していません。</small></fieldset>
   <fieldset><legend>描画品質</legend><select aria-label="描画品質" value={value.performance} onChange={e=>patch({performance:e.target.value as TwinSettings['performance']})}><option value="auto">自動（スマートフォンは軽量）</option><option value="quality">高精細</option><option value="fast">軽量</option></select><small>軽量では地形LODと建物の描画距離を抑えます。正式な地点標高は高精細データで確認します。</small></fieldset>
   <details><summary>島ごとの地形品質・場所へ移動</summary>{metadata?<div className="island-quality">{metadata.islands.map(island=><button key={island.name} onClick={()=>onFly(...island.center,14)}><strong>{island.name}</strong><span>DEM1A {((island.counts.DEM1A/island.landCells)*100).toFixed(1)}%</span><small>欠測 {((island.counts.NO_DATA/island.landCells)*100).toFixed(2)}%</small></button>)}<p>町の陸域に重なるz17セルを集計。確率的な信頼度・測量精度の実地検証ではありません。</p></div>:<p>{failed?'品質情報を取得できません。':'品質情報を読み込み中…'}</p>}</details>
   <details><summary>Developer Mode</summary><label><input type="checkbox" checked={value.coverage} onChange={e=>patch({coverage:e.target.checked})}/>DEM Coverageを重ねる</label><div className="coverage-legend"><span><i style={{background:'#1f937f'}}/>DEM1A・1m</span><span><i style={{background:'#378bc7'}}/>DEM5A・5m</span><span><i style={{background:'#8162ca'}}/>DEM5B/C・5m</span><span><i style={{background:'#d49535'}}/>DEM10B・10m</span></div><small>透明部分は欠測または町域外。Contour・AW3D30・AIは未使用です。</small><label><input type="checkbox" checked={value.debug} onChange={e=>patch({debug:e.target.checked})}/>タイル境界・描画情報</label></details>
   <button className="twin-data" onClick={onData}>Data · データと出典</button>
  </div>
 </section>;
}
