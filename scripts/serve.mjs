import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('out'),port=Number(process.env.PORT??4173),host=process.env.HOST??'127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.geojson':'application/geo+json','.png':'image/png','.svg':'image/svg+xml','.pmtiles':'application/vnd.pmtiles'};
http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const prefix=(process.env.BASE_PATH??'').replace(/\/$/,'');
  if(prefix){if(pathname!==prefix&&!pathname.startsWith(prefix+'/')){res.writeHead(404);res.end();return;}pathname=pathname.slice(prefix.length)||'/';}
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const info=await stat(file);if(!info.isFile())throw Error();
  res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.setHeader('Accept-Ranges','bytes');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  let start=0,end=info.size-1,status=200;
  if(req.headers.range){
   const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
   if(!m){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
   start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;
   if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
   status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
  }
  res.writeHead(status,{'Content-Length':end-start+1});if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,host,()=>console.log(`KAMIJIMA GIS: http://${host}:${port}`));
