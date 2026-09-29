import type {Feature,Point,GeoJsonProperties,FeatureCollection} from 'geojson';
export const facilityKinds:Record<string,string>={'public-facilities':'公共施設',emergency:'指定緊急避難場所',shelter:'指定避難所'};
export function facilityFeatures(datasets:Record<string,FeatureCollection>,selected:string[]){
 const seen=new Set<string>(),result:{feature:Feature<Point>;properties:GeoJsonProperties}[]=[];
 for(const id of ['public-facilities','shelter','emergency']){
  if(!selected.includes(id))continue;
  for(const f of datasets[id]?.features??[]){if(f.geometry.type!=='Point'||!f.properties?.name)continue;
   const [lng,lat]=f.geometry.coordinates;const key=`${String(f.properties.name).replace(/^上島町立?|[\s　]/g,'')}-${lng.toFixed(3)}-${lat.toFixed(3)}`;
   if(seen.has(key))continue;seen.add(key);result.push({feature:f as Feature<Point>,properties:{...f.properties,facilityKind:facilityKinds[id]}});
  }
 }
 return result.sort((a,b)=>Number(b.properties?.plan?.category==='行政系施設')-Number(a.properties?.plan?.category==='行政系施設'));
}
