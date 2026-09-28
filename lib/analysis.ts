import {booleanPointInPolygon,point,distance} from '@turf/turf';
import type {Area,Facilities,HazardResult,Layer} from './types';
export function contains(area:Area,coords:[number,number]):boolean{return area.features.some(f=>booleanPointInPolygon(point(coords),f));}
export function analyse(l:Layer,coords:[number,number],data:Area|undefined,boundary:Area|undefined,loading=false):HazardResult{
 const result=(state:HazardResult['state'],reason:string,matches=0,classLabel?:string):HazardResult=>({state,reason,matches,classLabel});
 if(!boundary)return result('NO_DATA','行政区域を取得できず、対象範囲を確認できません。');
 if(!contains(boundary,coords))return result('OUT_OF_COVERAGE','上島町の行政区域データ（陸域）の範囲外です。');
 if(loading)return result('NOT_CHECKED','判定データを読み込み中です。');
 if(l.status==='DATA_SOURCE_PENDING')return result('NO_DATA',l.notes);
 if(l.kind!=='polygon'||!data)return result('NO_DATA','地点判定用のベクターデータがありません。画像の空白は非該当を意味しません。');
 const hits=data.features.filter(f=>booleanPointInPolygon(point(coords),f));
 if(hits.length)return {...result('APPLICABLE','取得した公的想定区域との交差を確認しました。境界上の地点も該当として扱います。',hits.length,[...new Set(hits.map(f=>String(f.properties?.classLabel??l.title)))].join(' / ')),areas:hits.map(f=>({name:String(f.properties?.name??'名称なし'),phenomenon:String(f.properties?.phenomenon??'未確認'),noticeDate:String(f.properties?.noticeDate??'未確認'),areaCode:String(f.properties?.areaCode??'未確認')}))};
 if(!l.coverageVerified)return result('NO_DATA','該当する図形は見つかりませんでしたが、データの収録範囲の完全性が未確認です。');
 return result('NOT_APPLICABLE','確認済みのデータ対象範囲内で、取得した想定区域に該当しません。安全を意味しません。');
}
export function overlapCount(results:Record<string,HazardResult>,registry:Layer[]){return new Set(registry.filter(l=>l.hazardKind&&results[l.id]?.state==='APPLICABLE').map(l=>l.hazardKind)).size;}
export function nearest(coords:[number,number],data:Facilities,limit=3){return data.features.map(f=>({feature:f,km:distance(point(coords),f)})).sort((a,b)=>a.km-b.km).slice(0,limit);}
export const stateLabels={APPLICABLE:'想定区域に該当',NOT_APPLICABLE:'取得した想定区域に非該当',NO_DATA:'判定データなし',NOT_CHECKED:'確認中',OUT_OF_COVERAGE:'対象範囲外'};
