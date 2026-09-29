/* Bump this version whenever published datasets or the app shell change. */
const VERSION='kamijima-3d-20260929-v1';
const SHELL=VERSION+'-shell',DATA=VERSION+'-data';
const ROOT=new URL(self.registration.scope);
const inside=url=>url.origin===ROOT.origin&&url.pathname.startsWith(ROOT.pathname);
const shell=url=>inside(url)&&(url.pathname===ROOT.pathname||url.pathname.startsWith(ROOT.pathname+'_next/static/'));
const data=url=>inside(url)&&url.pathname.startsWith(ROOT.pathname+'data/')&&!url.pathname.endsWith('.pmtiles');
const gsi=url=>url.origin==='https://cyberjapandata.gsi.go.jp'&&url.pathname.startsWith('/xyz/')&&/\.(png|jpg)$/.test(url.pathname);
async function save(name,request,response,max){
 if(!response.ok||response.status!==200||response.type==='opaque')return;
 const length=Number(response.headers.get('content-length')||0);if(length>8*1024*1024)return;
 const cache=await caches.open(name);await cache.put(request,response);const keys=await cache.keys();
 await Promise.all(keys.slice(0,Math.max(0,keys.length-max)).map(key=>cache.delete(key)));
}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(SHELL);await cache.add(ROOT.href);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(key=>key.startsWith('kamijima-')&&!key.startsWith(VERSION)).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('message',event=>{
 if(event.data?.type!=='CACHE_SHELL'||!Array.isArray(event.data.urls))return;
 event.waitUntil(Promise.all(event.data.urls.slice(0,64).map(async value=>{try{const url=new URL(value);if(!shell(url))return;const response=await fetch(url);await save(SHELL,url.href,response,80);}catch{/* A later visit can warm missing chunks. */}})));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||request.headers.has('range')||url.search)return;
 const navigation=request.mode==='navigate'&&inside(url);
 if(!navigation&&!shell(url)&&!data(url)&&!gsi(url))return;
 event.respondWith((async()=>{
  const name=navigation||shell(url)?SHELL:DATA,key=navigation?ROOT.href:request;
  const cache=await caches.open(name),saved=await cache.match(key);
  if(saved&&!navigation)return saved;
  try{const response=await fetch(request);event.waitUntil(save(name,key,response.clone(),name===SHELL?80:192).catch(()=>{}));return response;}
  catch(error){if(saved)return saved;throw error;}
 })());
});
