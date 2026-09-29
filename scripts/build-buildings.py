"""OSM footprints and forest polygons to spatially indexed PMTiles.
Heights from tags are unverified OSM attributes; estimates are always labelled.
"""
from pathlib import Path
import json,math,re,gzip
import osmium,mapbox_vector_tile
from shapely.geometry import shape,mapping,box
from shapely.ops import unary_union,transform
from shapely import make_valid,STRtree
from pyproj import Transformer
from pmtiles.writer import write
from pmtiles.tile import zxy_to_tileid,Compression,TileType
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/data';PBF=ROOT/'data/raw/shikoku-260927.osm.pbf'
land=unary_union([shape(f['geometry']) for f in json.loads((OUT/'boundary.geojson').read_text())['features']])
factory=osmium.geom.GeoJSONFactory();projection=Transformer.from_crs(4326,3857,always_xy=True).transform
def number(value):
 if not value:return None
 match=re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(m|米)?\s*',value)
 return float(match.group(1)) if match else None
class Handler(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.buildings=[];self.forest=[];self.invalid=0
 def area(self,a):
  building=a.tags.get('building');forest=a.tags.get('natural')=='wood' or a.tags.get('landuse')=='forest'
  if (not building or building=='no') and not forest:return
  try:
   geom=shape(json.loads(factory.create_multipolygon(a)))
   if not land.intersects(geom):return
   if not geom.is_valid:geom=make_valid(geom)
   if geom.geom_type not in ['Polygon','MultiPolygon']:return
   if building and building!='no':
    h=number(a.tags.get('height'));levels=number(a.tags.get('building:levels'))
    if h is not None and 1<=h<=250:estimated=False;method='OSM height tag (unverified)'
    elif levels is not None and 0<levels<=60:h=levels*3;estimated=True;method='OSM levels x 3m'
    else:h=3 if building in ['garage','garages','shed','roof'] else 6;estimated=True;method='Default height by building type'
    self.buildings.append((transform(projection,geom),{'id':str(a.orig_id()),'height':round(h,1),'Estimated':estimated,'height_source':method,'kind':building}))
   elif forest:
    self.forest.append((transform(projection,geom),{'id':str(a.orig_id()),'height':8,'Estimated':True,'height_source':'Illustrative canopy 8m'}))
  except (ValueError,RuntimeError):self.invalid+=1
handler=Handler();handler.apply_file(str(PBF),locations=True,idx='flex_mem')
HALF=20037508.342789244
def tileset(name,items,minz,maxz):
 if not items:return
 geoms=[g for g,_ in items];tree=STRtree(geoms);extent=unary_union(geoms).bounds;tiles=[]
 for z in range(minz,maxz+1):
  span=2*HALF/2**z
  for x in range(int((extent[0]+HALF)//span),int((extent[2]+HALF)//span)+1):
   for y in range(int((HALF-extent[3])//span),int((HALF-extent[1])//span)+1):
    bounds=(-HALF+x*span,HALF-(y+1)*span,-HALF+(x+1)*span,HALF-y*span);region=box(*bounds);features=[]
    for i in tree.query(region,predicate='intersects'):
     geom,props=items[i];clipped=geom.intersection(region).simplify(.2 if z>=15 else 1,preserve_topology=True)
     if clipped.is_empty or clipped.geom_type not in ['Polygon','MultiPolygon']:continue
     features.append({'geometry':mapping(clipped),'properties':props})
    if features:
     data=mapbox_vector_tile.encode({'name':name,'features':features},default_options={'quantize_bounds':bounds,'extents':4096});tiles.append((zxy_to_tileid(z,x,y),gzip.compress(data,mtime=0)))
  print(name,'LOD',z,'tiles',len(tiles),flush=True)
 with write(str(OUT/f'{name}.pmtiles')) as writer:
  for tid,data in sorted(tiles):writer.write_tile(tid,data)
  b=land.bounds
  writer.finalize({'tile_type':TileType.MVT,'tile_compression':Compression.GZIP,'min_zoom':minz,'max_zoom':maxz,'min_lon_e7':int(b[0]*1e7),'min_lat_e7':int(b[1]*1e7),'max_lon_e7':int(b[2]*1e7),'max_lat_e7':int(b[3]*1e7),'center_zoom':14,'center_lon_e7':1332100000,'center_lat_e7':342600000},{'name':name,'attribution':'© OpenStreetMap contributors, ODbL 1.0','vector_layers':[{'id':name,'minzoom':minz,'maxzoom':maxz,'fields':{'height':'Number','Estimated':'Boolean','height_source':'String','kind':'String'}}]})
tileset('buildings',handler.buildings,12,16);tileset('vegetation',handler.forest,11,14)
metadata={'source':'OpenStreetMap contributors / Geofabrik Shikoku 2026-09-27','url':'https://download.geofabrik.de/asia/japan/shikoku-260927.osm.pbf','license':'ODbL 1.0','processedDate':'2026-09-29','buildings':len(handler.buildings),'estimatedBuildings':sum(p['Estimated'] for _,p in handler.buildings),'taggedHeights':sum(not p['Estimated'] for _,p in handler.buildings),'forestAreas':len(handler.forest),'invalidSkipped':handler.invalid,'limitations':'Footprint coverage is incomplete. Height tags are not verified measurements; levels x3m or defaults 3/6m are estimates. Forest canopy 8m is illustrative, not measured.'}
(OUT/'buildings-metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(metadata),flush=True)
