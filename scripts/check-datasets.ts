import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {layers} from '../lib/registry';
// Reports only. Never modifies raw data, registry, public data, or the previous baseline.
const previousPath=process.argv[2];
const previous:Record<string,{hash:string|null}>=previousPath?JSON.parse(await readFile(previousPath,'utf8')):{};
const results:Record<string,unknown>={};
for(const url of new Set(layers.map(l=>l.sourceUrl))){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(30000)});
  const b=Buffer.from(await r.arrayBuffer());if(b.length>10_000_000)throw Error('Source page exceeds 10 MB');
  const hash=createHash('sha256').update(b).digest('hex');
  results[url]={checkedAt:new Date().toISOString(),status:r.status,etag:r.headers.get('etag'),lastModified:r.headers.get('last-modified'),hash,changed:previous[url]?previous[url].hash!==hash:null};
 }catch{results[url]={checkedAt:new Date().toISOString(),status:'FETCH_FAILED',hash:null,changed:null};}
}
await mkdir('data/metadata/checks',{recursive:true});
const name=`data/metadata/checks/${new Date().toISOString().replaceAll(':','-')}.json`;
await writeFile(name,JSON.stringify(results,null,2),{flag:'wx'});console.log(name);
