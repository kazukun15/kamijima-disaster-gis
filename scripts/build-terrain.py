"""Reproducible GSI priority mosaic. Official cells never use visual interpolation.

Run from project root with numpy, Pillow and shapely installed. Network responses
are cached in data/raw/terrain; 404 is coverage absence, other errors abort.
"""
from pathlib import Path
import math,json,io,time,threading,concurrent.futures,urllib.request,urllib.error,hashlib
import numpy as np
from PIL import Image,ImageDraw
from shapely.geometry import shape,box,Point
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/data/terrain';RAW=ROOT/'data/raw/terrain';TMP=ROOT/'data/processed/terrain'
Z=17;N=256;DATE='2026-09-29'
SOURCES=[(1,'DEM1A','dem1a_png',17,1,'VERY HIGH'),(2,'DEM5A','dem5a_png',15,5,'HIGH'),(3,'DEM5B','dem5b_png',15,5,'MEDIUM-HIGH'),(4,'DEM5C','dem5c_png',15,5,'MEDIUM-HIGH'),(5,'DEM10B','dem_png',14,10,'MEDIUM')]
COLORS=np.array([[110,120,130,0],[31,147,127,175],[55,139,199,175],[129,98,202,175],[166,126,192,175],[212,149,53,175]],dtype=np.uint8)
locks={};guard=threading.Lock();requests={};native={}
def xy(lon,lat,z):return ((lon+180)/360*2**z,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
def lonlat(x,y,z):return (x/2**z*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*y/2**z)))))
def bounds(x,y,z):
 w,n=lonlat(x,y,z);e,s=lonlat(x+1,y+1,z);return w,s,e,n
def fetch(source,z,x,y):
 key=f'{source}/{z}/{x}/{y}'
 with guard:lock=locks.setdefault(key,threading.Lock())
 with lock:
  if key in native:return native[key]
  path=RAW/(key+'.png');missing=path.with_suffix('.404');data=None
  if missing.exists():requests[key]={'http':404};return None
  if path.exists():data=path.read_bytes()
  else:
   url=f'https://cyberjapandata.gsi.go.jp/xyz/{key}.png'
   for attempt in range(3):
    try:
     with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'KamijimaTerrainBuild/1.0'}),timeout=30) as r:data=r.read()
     break
    except urllib.error.HTTPError as e:
     if e.code==404:path.parent.mkdir(parents=True,exist_ok=True);missing.touch();requests[key]={'http':404};return None
     if attempt==2:raise
    except Exception:
     if attempt==2:raise
    time.sleep(attempt+1)
   path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
  rgb=np.array(Image.open(io.BytesIO(data)).convert('RGB'),dtype=np.int32)
  value=rgb[:,:,0]*65536+rgb[:,:,1]*256+rgb[:,:,2];h=np.where(value>8388608,value-16777216,value)/100.;h[value==8388608]=np.nan
  requests[key]={'http':200,'sha256':hashlib.sha256(data).hexdigest()}
  # Only coarse tiles are reused by many high-resolution tiles.
  if z<17:native[key]=h
  return h
def sample(source,native_z,z,x,y):
 q=max(0,z-native_z);scale=2**q;a=fetch(source,min(z,native_z),x//scale,y//scale)
 if a is None:return None
 ix=((x%scale)*N+np.arange(N))//scale;iy=((y%scale)*N+np.arange(N))//scale
 return a[np.ix_(iy,ix)]
def save(path,array):path.parent.mkdir(parents=True,exist_ok=True);Image.fromarray(array).save(path,optimize=True)
def encode(h,gsi=False):
 if gsi:
  value=np.where(np.isfinite(h),np.rint(np.nan_to_num(h)*100),8388608).astype(np.int64);value=np.where(value<0,value+16777216,value)
 else:value=np.clip(np.rint((np.nan_to_num(h)+10000)*10),0,16777215).astype(np.int64)
 return np.stack([(value>>16)&255,(value>>8)&255,value&255],axis=2).astype(np.uint8)
features=json.loads((ROOT/'public/data/boundary.geojson').read_text(encoding='utf-8'))['features']
land=unary_union([shape(f['geometry']) for f in features]);polygons=list(land.geoms) if land.geom_type=='MultiPolygon' else [land]
ISLAND_SEEDS={'弓削島':(133.211,34.271),'佐島':(133.1881,34.24256),'生名島':(133.184,34.263),'岩城島':(133.146,34.263),'魚島':(133.32,34.176),'高井神島':(133.27041,34.19017)}
major={name:next(p for p in polygons if p.covers(Point(pos))) for name,pos in ISLAND_SEEDS.items()}
def mask(poly,x,y):
 im=Image.new('L',(N,N));draw=ImageDraw.Draw(im)
 parts=list(poly.geoms) if poly.geom_type=='MultiPolygon' else [poly]
 for p in parts:
  if p.geom_type!='Polygon':continue
  def points(r):return [((xy(a,b,Z)[0]-x)*N,(xy(a,b,Z)[1]-y)*N) for a,b,*_ in r.coords]
  draw.polygon(points(p.exterior),fill=1)
  for ring in p.interiors:draw.polygon(points(ring),fill=0)
 return np.array(im,dtype=bool)
minlon,minlat,maxlon,maxlat=land.bounds;x0,y1=xy(minlon,minlat,Z);x1,y0=xy(maxlon,maxlat,Z)
tiles=[(x,y) for x in range(int(x0),int(x1)+1) for y in range(int(y0),int(y1)+1) if land.intersects(box(*bounds(x,y,Z)))]
TMP.mkdir(parents=True,exist_ok=True)
def official(tile):
 x,y=tile;h=np.full((N,N),np.nan);source=np.zeros((N,N),np.uint8)
 # Preserve each higher-priority cell, fill missing cells only.
 for code,_,url,nz,_,_ in SOURCES:
  a=sample(url,nz,Z,x,y)
  if a is not None:
   take=~np.isfinite(h)&np.isfinite(a);h[take]=a[take];source[take]=code
 m=mask(land.intersection(box(*bounds(x,y,Z))),x,y)
 np.savez_compressed(TMP/f'{x}-{y}.npz',h=h,s=source,m=m)
 save(OUT/f'official/{Z}/{x}/{y}.png',encode(h,True));save(OUT/f'sources/{Z}/{x}/{y}.png',source)
 rgba=COLORS[source].copy();rgba[~m,3]=0;save(OUT/f'confidence/{Z}/{x}/{y}.png',rgba)
 counts={name:int(np.sum(m&(source==code))) for code,name,*_ in SOURCES};counts['NO_DATA']=int(np.sum(m&(source==0)))
 island_counts={}
 for name,poly in major.items():
  if poly.intersects(box(*bounds(x,y,Z))):
   im=mask(poly.intersection(box(*bounds(x,y,Z))),x,y);island_counts[name]={label:int(np.sum(im&(source==code))) for code,label,*_ in SOURCES};island_counts[name]['NO_DATA']=int(np.sum(im&(source==0)))
 return {'key':f'{Z}/{x}/{y}','counts':counts,'islands':island_counts}
print('native terrain tiles',len(tiles),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 records=[]
 for i,record in enumerate(pool.map(official,tiles)):
  records.append(record)
  if i%100==0:print('official',i+1,'/',len(tiles),flush=True)

# Visual treatment only. Read a halo so processing does not create tile-edge steps.
tile_set=set(tiles);visual_changes=0
def visual(tile):
 x,y=tile;d=np.load(TMP/f'{x}-{y}.npz');h=d['h'].copy();s=d['s'];m=d['m'];original=h.copy()
 padded=np.pad(h,1,constant_values=np.nan);sp=np.pad(s,1);mp=np.pad(m,1)
 for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]:
  if (x+dx,y+dy) not in tile_set:continue
  neighbor=np.load(TMP/f'{x+dx}-{y+dy}.npz')
  if dx==-1:padded[1:-1,0]=neighbor['h'][:,-1];sp[1:-1,0]=neighbor['s'][:,-1];mp[1:-1,0]=neighbor['m'][:,-1]
  if dx==1:padded[1:-1,-1]=neighbor['h'][:,0];sp[1:-1,-1]=neighbor['s'][:,0];mp[1:-1,-1]=neighbor['m'][:,0]
  if dy==-1:padded[0,1:-1]=neighbor['h'][-1,:];sp[0,1:-1]=neighbor['s'][-1,:];mp[0,1:-1]=neighbor['m'][-1,:]
  if dy==1:padded[-1,1:-1]=neighbor['h'][0,:];sp[-1,1:-1]=neighbor['s'][0,:];mp[-1,1:-1]=neighbor['m'][0,:]
 neighbors=[padded[1:-1,:-2],padded[1:-1,2:],padded[:-2,1:-1],padded[2:,1:-1]]
 codes=[sp[1:-1,:-2],sp[1:-1,2:],sp[:-2,1:-1],sp[2:,1:-1]]
 stacked=np.stack(neighbors);valid=np.isfinite(stacked);count=valid.sum(axis=0);mean=np.nansum(stacked,axis=0)/np.maximum(count,1)
 lower_side=np.logical_or.reduce([(c>0)&(c<s) for c in codes])&(s>1)&(count>0)
 # Feather/slope correction on the lower-quality side; bound displacement to 1 m.
 h[lower_side]+=np.clip((mean[lower_side]-h[lower_side])*.35,-1,1)
 holes=m&~np.isfinite(h)&(count>=3);h[holes]=mean[holes]
 # N03 land boundary is only a visual shoreline proxy, never an elevation source.
 # Water/no-data outside land is a 0 m drawing surface, not a measured value.
 coast=(~m)&(mp[1:-1,:-2]|mp[1:-1,2:]|mp[:-2,1:-1]|mp[2:,1:-1])
 h[coast]=0 # Sea-side boundary constraint; never flatten surveyed land cells.
 h[~m&~np.isfinite(h)]=0
 h[~m&(h<0)]=0
 h[~np.isfinite(h)]=0
 changed=int(np.sum(~np.isfinite(original)|(np.abs(h-original)>.01)))
 save(OUT/f'visual/{Z}/{x}/{y}.png',encode(h))
 return changed
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:visual_changes=sum(pool.map(visual,tiles))

# Precomputed visual LOD; original highest-resolution official cells stay untouched.
levels={Z:tile_set}
for z in range(Z-1,9,-1):
 levels[z]={(x//2,y//2) for x,y in levels[z+1]}
 for x,y in sorted(levels[z]):
  base=sample('dem_png',14,z,x,y);base=np.zeros((N,N)) if base is None else np.nan_to_num(base)
  rgb=np.repeat(np.repeat(encode(base),2,axis=0),2,axis=1);confidence=np.zeros((512,512,4),np.uint8)
  for dx in [0,1]:
   for dy in [0,1]:
    cx,cy=x*2+dx,y*2+dy;p=OUT/f'visual/{z+1}/{cx}/{cy}.png';cp=OUT/f'confidence/{z+1}/{cx}/{cy}.png'
    if p.exists():rgb[dy*N:(dy+1)*N,dx*N:(dx+1)*N]=np.array(Image.open(p))
    if cp.exists():confidence[dy*N:(dy+1)*N,dx*N:(dx+1)*N]=np.array(Image.open(cp))
  # Decode before averaging; RGB byte averaging would corrupt terrain heights.
  value=rgb[:,:,0].astype(float)*65536+rgb[:,:,1].astype(float)*256+rgb[:,:,2]
  height=(value*.1-10000).reshape(N,2,N,2).mean(axis=(1,3))
  save(OUT/f'visual/{z}/{x}/{y}.png',encode(height));save(OUT/f'confidence/{z}/{x}/{y}.png',confidence[::2,::2])
 print('visual LOD',z,len(levels[z]),flush=True)
total={label:sum(r['counts'][label] for r in records) for label in [s[1] for s in SOURCES]+['NO_DATA']}
islands=[]
for name,p in major.items():
 counts={label:sum(r['islands'].get(name,{}).get(label,0) for r in records) for label in total}
 center=p.representative_point();islands.append({'name':name,'center':[center.x,center.y],'counts':counts,'landCells':sum(counts.values())})
metadata={'version':1,'generatedAt':DATE,'datum':'GSI elevation tiles updated to JGD2024 heights in March 2026','nativeZoom':17,'minVisualZoom':10,'maxVisualZoom':17,'sourceLegend':[{'code':c,'source':name,'resolution':res,'confidence':quality,'nativeZoom':nz,'url':f'https://cyberjapandata.gsi.go.jp/xyz/{url}/{{z}}/{{x}}/{{y}}.png'} for c,name,url,nz,res,quality in SOURCES],'officialTiles':[r['key'] for r in records],'visualTiles':[f'{z}/{x}/{y}' for z,items in levels.items() for x,y in sorted(items)],'totals':total,'islands':islands,'visualModifiedCells':visual_changes,'tileMetadata':{r['key']:r['counts'] for r in records},'confidenceMeaning':'Relative source quality class, not probability or a guarantee of accuracy','coastline':'N03 2026 land polygons as visual proxy; unknown sea cells render at zero only','visualEnhanced':True}
(OUT/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(RAW/'fetch-audit.json').write_text(json.dumps(requests,indent=2),encoding='utf-8')
print(json.dumps({'totals':total,'islands':islands},ensure_ascii=False),flush=True)
