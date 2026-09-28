"""Infer an explicitly labelled working CRS, validate, tile and index public parcels.
No raw data is overwritten. EPSG:2446 is a working assumption, not a source assertion.
"""
from pathlib import Path
import json,math,gzip
import geopandas as gpd
import pandas as pd
from shapely import make_valid
from shapely.geometry import box,mapping
from pyproj import Transformer
from pmtiles.writer import write
from pmtiles.tile import zxy_to_tileid,Compression,TileType
import mapbox_vector_tile
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'data/raw';PUBLIC=ROOT/'public/data';OUT=ROOT/'data/processed'
parts=[];audit=[];candidates=[]
boundary=gpd.read_file(PUBLIC/'boundary.geojson').to_crs(3857).geometry.union_all()
for p in (RAW/'cadastral').rglob('*.shp'):
    g=gpd.read_file(p)
    fields=list(g.columns)
    if any(any(t in field for t in ['所有者','納税','氏名','課税','電話']) for field in fields):raise ValueError('Privacy review required')
    null=int(g.geometry.isna().sum());invalid=int((~g.geometry.is_valid).sum());duplicates=int(g.geometry.to_wkb().duplicated().sum())
    if null:raise ValueError('Null geometry')
    audit.append({'file':p.name,'count':len(g),'null':null,'invalid':invalid,'duplicateGeometry':duplicates,'sourceCrs':str(g.crs),'encoding':p.with_suffix('.cpg').read_text(),'sourceFields':fields,'exportedFields':['district','area','parcel','id'],'repair':'shapely.make_valid'})
    g=g[['字','地番','geometry']].copy();g.geometry=g.geometry.map(make_valid)
    g['district']={'ikina':'生名','iwagi':'岩城','yuge':'弓削'}[p.stem]
    g=g.rename(columns={'字':'area','地番':'parcel'});parts.append(g)
g=gpd.GeoDataFrame(pd.concat(parts,ignore_index=True));g['id']=g.index
sample=g.geometry.representative_point()[::20]
for epsg in [2443,2444,2445,2446,2447,2448,6672,30164]:
    pts=gpd.GeoSeries(sample,crs=epsg).to_crs(3857)
    candidates.append({'epsg':epsg,'sampleCount':len(pts),'insideAdministrativeLand':int(pts.map(boundary.covers).sum()),'medianOutsideDistanceMetres':float(pts.map(boundary.distance).median())})
working=g.set_crs(2446).to_crs(3857)
if sum(working.geometry.representative_point()[::20].map(boundary.covers))/len(sample)<.95:raise ValueError('CRS consistency threshold failed')
geo=working.to_crs(4326)
report={'sourceCrs':None,'adoptedWorkingCrs':'EPSG:2446','confidence':'INFERRED','reason':'Plane rectangular zone IV aligns with town land; Tokyo datum has much poorer alignment. JGD2000 and JGD2011 cannot be distinguished by this evidence. User authorized analytical introduction of a representative CRS.','candidates':candidates,'files':audit,'unresolved':['Authoritative datum confirmation','Survey precision','Boundary discrepancies','Uoshima and other areas absent from source ZIP']}
(ROOT/'data/metadata/cadastral-crs-analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
index=[]
for i,row in geo.iterrows():
    p=row.geometry.representative_point();index.append({'id':int(i),'district':row.district,'area':str(row.area or ''),'parcel':str(row.parcel or ''),'lng':round(p.x,7),'lat':round(p.y,7)})
(PUBLIC/'parcel-search.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
# Keep precise working GeoJSON outside public/. Browser reads spatially indexed PMTiles only.
geo.to_file(OUT/'cadastral.geojson',driver='GeoJSON')
half=20037508.342789244;sindex=working.sindex;tiles=[]
minx,miny,maxx,maxy=working.total_bounds
for z in [15,16,17]:
    span=2*half/(2**z)
    for x in range(int((minx+half)//span),int((maxx+half)//span)+1):
        for y in range(int((half-maxy)//span),int((half-miny)//span)+1):
            bounds=(-half+x*span,half-(y+1)*span,-half+(x+1)*span,half-y*span)
            region=box(*bounds);indices=sindex.query(region,predicate='intersects')
            if not len(indices):continue
            features=[]
            for i in indices:
                row=working.iloc[i];geom=row.geometry.intersection(region).simplify(.15,preserve_topology=True)
                if geom.is_empty or geom.geom_type not in ['Polygon','MultiPolygon']:continue
                features.append({'geometry':mapping(geom),'id':int(row.id),'properties':{'id':int(row.id),'district':row.district,'area':str(row.area or ''),'parcel':str(row.parcel or '')}})
            if not features:continue
            tile=mapbox_vector_tile.encode({'name':'cadastral','features':features},default_options={'quantize_bounds':bounds,'extents':4096})
            tiles.append((zxy_to_tileid(z,x,y),gzip.compress(tile,mtime=0)))
    print('built zoom',z,'cumulative tiles',len(tiles),flush=True)
b=geo.total_bounds
with write(str(PUBLIC/'cadastral.pmtiles')) as writer:
    for tileid,data in sorted(tiles):writer.write_tile(tileid,data)
    writer.finalize({'tile_type':TileType.MVT,'tile_compression':Compression.GZIP,'min_zoom':15,'max_zoom':17,'min_lon_e7':int(b[0]*1e7),'min_lat_e7':int(b[1]*1e7),'max_lon_e7':int(b[2]*1e7),'max_lat_e7':int(b[3]*1e7),'center_zoom':15,'center_lon_e7':int((b[0]+b[2])*5e6),'center_lat_e7':int((b[1]+b[3])*5e6)}, {'name':'上島町地籍図（推定座標系・参考）','attribution':'上島町 CC BY 4.0 / EPSG:2446 inferred','vector_layers':[{'id':'cadastral','fields':{'district':'String','area':'String','parcel':'String','id':'Number'},'minzoom':15,'maxzoom':17}]})
print('parcels',len(geo),'PMTiles bytes',(PUBLIC/'cadastral.pmtiles').stat().st_size,flush=True)
