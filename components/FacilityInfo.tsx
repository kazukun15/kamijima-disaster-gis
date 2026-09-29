import type {GeoJsonProperties} from 'geojson';
export interface FacilityPlan {id:string;name:string;category:string;planDate:string;floorArea:number;buildings:{name:string;department:string;area:number;structure:string;built:string;pdfPage:number}[];}
export default function FacilityInfo({properties:p}:{properties:GeoJsonProperties}){
 if(!p)return null;
 if(Array.isArray(p.plans))return <>{(p.plans as FacilityPlan[]).map(plan=><FacilityInfo key={plan.id} properties={{...p,plans:undefined,plan}}/>)}</>;
 const plan=p.plan as FacilityPlan|undefined;
 return <section className="facility-info" aria-label="選択した施設の情報"><p className="eyebrow">FACILITY INFORMATION</p><h3>{String(p.name)}</h3>{p.facilityKind&&<p>{String(p.facilityKind)}</p>}{p.address&&<p>{String(p.address)}</p>}
 {plan?<><p className="facility-date">上島町個別施設計画 · 2021年3月時点</p><dl><dt>計画上の施設名</dt><dd>{plan.name}</dd><dt>用途分類</dt><dd>{plan.category}</dd><dt>対象建物</dt><dd>{plan.buildings.length}棟</dd><dt>延床面積合計</dt><dd>{plan.floorArea.toLocaleString()} m²</dd></dl><details><summary>計画の建物内訳を見る</summary>{plan.buildings.map((b,i)=><article key={i}><strong>{b.name}</strong><p>{b.structure} · {b.area.toLocaleString()} m²</p><p>建築：{b.built}<br/>所管：{b.department}</p><a href={`https://www.town.kamijima.lg.jp/uploaded/life/19667_70461_misc.pdf#page=${b.pdfPage}`} target="_blank" rel="noreferrer">計画PDF {b.pdfPage}ページ ↗</a></article>)}</details><small>施設全体の計画情報です。2021年以降の建替え・用途変更・開設状況は反映されていない場合があります。</small></>:<p className="facility-date">この施設に対応する個別施設計画の情報は確認できていません。</p>}
 {p.facilityKind!=='公共施設'&&<p><small>避難指定と施設管理計画は別の情報です。現在の開設状況は示しません。</small></p>}{p.positionSource&&<><p><small>位置資料：{String(p.positionDate??'時点未確認')}。{String(p.positionNote??'')}</small></p><a href={String(p.positionSource)} target="_blank" rel="noreferrer">位置情報の出典 ↗</a></>}
 </section>;
}
