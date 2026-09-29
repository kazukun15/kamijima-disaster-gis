import type {Layer, Category} from './types';
const hazardSource='https://disaportaldata.gsi.go.jp/hazardmap/copyright/opendata.html';
const catalog='https://www.pref.ehime.jp/opendata-catalog/dataset/3790.html';
const common={publishedDate:null,effectiveDate:null,downloadedDate:null,checkedDate:'2026-09-28',originalCrs:'不明',processedFormat:'未加工',originalFormat:'未確認',license:'要確認',notes:''};
const base=(id:string,title:string,category:Category,color:string):Layer=>({...common,id,title,category,color,publisher:'愛媛県',sourceUrl:catalog,status:'DATA_SOURCE_PENDING',kind:'pending',legend:[]});
const water=(id:string,title:string,tile:string):Layer=>({...base(id,title,'WATER','#4368a5'),hazardKind:id,status:'DISPLAY_ONLY',kind:'raster',publisher:'国土交通省・都道府県／国土地理院配信',sourceUrl:hazardSource,url:`https://disaportaldata.gsi.go.jp/raster/${tile}/{z}/{x}/{y}.png`,originalFormat:'XYZ PNG',originalCrs:'EPSG:3857',processedFormat:'原典タイルを直接表示',license:'国土地理院コンテンツ利用規約・ハザードマップポータル利用規約',notes:'画像表示のみ。透明・空白部分から非該当や収録範囲を判定しません。配信反映には遅れがあり、基準日は原典で確認してください。',legendUrl:'https://disaportaldata.gsi.go.jp/hazardmap/copyright/img/shinsui_legend3.png',legend:[]});
const landslide=(id:string,title:string,color:string):Layer=>({...base(id,title,'LANDSLIDE',color),hazardKind:'landslide',status:'READY',kind:'polygon',url:`/data/${id}.geojson`,publisher:'愛媛県（えひめ土砂災害情報マップ）',sourceUrl:'https://www.sabo.pref.ehime.jp/map/GisDownload.aspx',downloadedDate:'2026-09-28',originalFormat:'SHP / SHX / DBF / PRJ',originalCrs:'EPSG:2446 (JGD2000 / Japan Plane Rectangular CS IV)',processedFormat:'GeoJSON EPSG:4326',license:'えひめ土砂災害情報マップ利用上の注意（商用利用は県の許可が必要）',notes:'上島町を指定して全3現象を取得。基準日は各区域の告示日。行政界と区域境界には位置精度差があります。収録範囲の完全性は未確認のため、区域外を「非該当」とは判定しません。',legend:[{label:title,color}],coverageVerified:false});
const facility=(id:string,title:string,color:string):Layer=>({...base(id,title,'FACILITY',color),status:'READY',kind:'point',url:`/data/${id}.geojson`,publisher:'上島町登録／国土地理院配信',sourceUrl:'https://www.gsi.go.jp/bousaichiri/hinanbasho',downloadedDate:'2026-09-28',originalFormat:'GeoJSON tiles (z10)',originalCrs:'EPSG:4326',processedFormat:'GeoJSON EPSG:4326・町住所抽出',license:'国土地理院コンテンツ利用規約・指定緊急避難場所等の利用上の注意',notes:'各市町村の登録情報。随時更新され、未掲載・更新遅延があります。最新の指定・開設状況は町に確認してください。',legend:[{label:title,color}]});
export const layers:Layer[]=[
 {...base('tsunami','津波浸水想定','WATER','#feb24c'),hazardKind:'tsunami',status:'READY',kind:'polygon',url:'/data/tsunami.geojson',publisher:'国土交通省 国土数値情報／原典：愛媛県',sourceUrl:'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A40.html',effectiveDate:'2016-10-31',downloadedDate:'2026-09-28',originalFormat:'SHP / SHX / DBF / PRJ',originalCrs:'EPSG:6668 (JGD2011)',processedFormat:'GeoJSON EPSG:4326・上島町陸域に交差する区域を抽出',license:'2016年度ページ：防災・減災を目的とした公的利用（非商用利用）に限り再配信可。2024年度ページでは愛媛県をオープンデータと掲載。過年度の条件を併記。',notes:'2016年度版 A40-16_38。2026年の最新県想定ではありません。基準日は国土数値情報の整備基準日で、県想定の公表日とは異なります。原典の浸水深区分を保持し、本アプリの配色で表示。3,332区域を抽出し形状は未簡略化・未クリップ。非交差を安全・非該当とは判定しません。',coverageVerified:false,legend:[{"label": "0.01m以上 〜 0.3m未満", "color": "#ffffb2"}, {"label": "0.3m以上 〜 1m未満", "color": "#fed976"}, {"label": "1m以上 〜 2m未満", "color": "#feb24c"}, {"label": "2m以上 〜 3m未満", "color": "#fd8d3c"}, {"label": "3m以上 〜 4m未満", "color": "#f03b20"}, {"label": "4m以上 〜 5m未満", "color": "#bd0026"}]},
 water('surge','高潮浸水想定','03_hightide_l2_shinsuishin_data'),
 water('flood','洪水浸水想定（想定最大規模）','01_flood_l2_shinsuishin_data'),
 ...[['intensity','想定震度'],['liquefaction','液状化危険度'],['settlement','液状化沈下量']].map(([id,title]):Layer=>({...base(id,title,'EARTHQUAKE','#8f719c'),hazardKind:id==='settlement'?'liquefaction':id,license:'CC BY-NC-ND（配布カタログ表記）',publishedDate:'2026-07-26',effectiveDate:'2026-02-16',originalFormat:'ZIP（GISデータ）',notes:'原典の公開を確認。非営利・改変禁止条件と座標変換・クリッピング後の再配布可否を確認するまで取り込み保留。'})),
 landslide('landslide-warning','土砂災害警戒区域','#edbb46'),
 landslide('landslide-special','土砂災害特別警戒区域','#d55448'),
 {...base('boundary','行政区域','BASE','#267a76'),publisher:'国土交通省',sourceUrl:'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html',status:'READY',kind:'polygon',url:'/data/boundary.geojson',downloadedDate:'2026-09-28',originalFormat:'SHP',effectiveDate:'2026-01-01',originalCrs:'EPSG:6668 (JGD2011)',processedFormat:'GeoJSON EPSG:4326',license:'CC BY 4.0 / 国土数値情報利用約款',notes:'2026年1月1日基準。国土数値情報・行政区域からN03_007=38356を抽出。海域の管轄境界を示すものではありません。二次利用時は国土地理院への申請が必要となる場合があります。',legend:[{label:'上島町の行政区域（陸域）',color:'#267a76'}]},
 {...base('cadastral','地籍図（参考）','BASE','#7c7189'),status:'READY',kind:'pmtiles',url:'/data/cadastral.pmtiles',sourceLayer:'cadastral',legend:[{label:'地籍境界（推定CRS・参考）',color:'#7c7189'}],processedFormat:'PMTiles EPSG:3857 / GeoJSON EPSG:4326',publisher:'上島町',sourceUrl:'https://www.town.kamijima.lg.jp/site/opendata/',publishedDate:'2026-09-28',effectiveDate:'2026-01-01',downloadedDate:'2026-09-28',originalFormat:'SHP / SHX / DBF / CPG（PRJなし）',license:'CC BY 4.0',minzoom:15,notes:'40,757筆。原典PRJなし。行政界照合で整合した第IV系を推定採用（作業CRS EPSG:2446）。JGD2000/JGD2011の確定はできていません。15倍ズーム以上で表示。生名・岩城・弓削の公開分のみ。所有者・課税情報は非収録。境界・権利の証明や筆別の精密判断には使用できません。'},
 {...base('elevation','標高・陰影起伏','BASE','#809b79'),publisher:'国土地理院',sourceUrl:'https://maps.gsi.go.jp/development/ichiran.html',status:'DISPLAY_ONLY',kind:'raster',url:'https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png',originalFormat:'地理院タイル',originalCrs:'EPSG:3857',processedFormat:'原典タイル',license:'国土地理院コンテンツ利用規約',notes:'地形の陰影表示。数値標高は地点選択時にDEM1A優先のOfficial Terrainを参照し、出典と元解像度を表示します。現地測量値ではありません。',legend:[{label:'陰影（標高値は地点情報に表示）',color:'#809b79'}]},
 {...base('public-facilities','公共施設（個別施設計画）','FACILITY','#906233'),publisher:'上島町',sourceUrl:'https://www.town.kamijima.lg.jp/soshiki/2/19667.html',status:'READY',kind:'point',url:'/data/public-facilities.geojson',effectiveDate:'2021-03',downloadedDate:'2026-09-29',checkedDate:'2026-09-29',originalFormat:'PDF / 公共施設ガイド',originalCrs:'座標なし（公式ガイド・避難施設・OSMで照合）',processedFormat:'GeoJSON',license:'公開資料の施設名・数値等の事実情報を抽出。位置のOSM由来部分はODbL。',notes:'2021年3月の個別施設計画。施設名・建築年・構造・延床面積を抽出。位置を照合できた施設のみ地図に表示。現在の開設・避難指定は別情報です。',legend:[{label:'公共施設・ランドマーク',color:'#906233'}]},
 facility('emergency','指定緊急避難場所','#087e80'),facility('shelter','指定避難所','#536db0')
];
export const categories:Record<Category,string>={WATER:'水害',EARTHQUAKE:'地震',LANDSLIDE:'土砂災害',BASE:'地形・地籍',FACILITY:'公共・避難施設'};
export const scenarios:Record<string,{title:string;layers:string[]}>={
 custom:{title:'自由に選択',layers:['tsunami','boundary','emergency']},
 earthquake:{title:'南海トラフ巨大地震',layers:['intensity','liquefaction','settlement','tsunami','boundary','emergency']},
 rain:{title:'豪雨',layers:['flood','landslide-warning','landslide-special','boundary','emergency']},
 typhoon:{title:'台風・高潮',layers:['surge','flood','landslide-warning','landslide-special','boundary','emergency']}
};
export function validateRegistry(registry:Layer[]=layers){
 const ids=new Set<string>();
 for(const l of registry){
  if(ids.has(l.id))throw new Error('Duplicate layer: '+l.id); ids.add(l.id);
  for(const key of ['title','publisher','sourceUrl','checkedDate','license','originalFormat','originalCrs','processedFormat'] as const)if(!l[key])throw new Error('Missing metadata: '+key);
  if(!l.sourceUrl.startsWith('https://'))throw new Error('Source URL must be HTTPS');
  if(l.kind!=='pending'&&!l.url)throw new Error('Missing data URL');
  if(l.kind!=='pending'&&!l.legend.length&&!l.legendUrl)throw new Error('Missing legend');
 }
 return true;
}
