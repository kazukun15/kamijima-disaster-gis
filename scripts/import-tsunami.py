"""Import original A40 Ehime tsunami polygons without simplification or clipping."""
from pathlib import Path
import json,hashlib
import geopandas as gpd
from shapely.geometry import mapping
from shapely import make_valid
ROOT=Path(__file__).resolve().parents[1]
raw=ROOT/'data/raw/tsunami-a40'
boundary=gpd.read_file(ROOT/'public/data/boundary.geojson').to_crs(6668).geometry.union_all()
g=gpd.read_file(next(raw.glob('*.shp')),bbox=tuple(boundary.bounds))
assert g.crs.to_epsg()==6668
assert set(g.A40_002)=={'38'}
invalid=int((~g.is_valid).sum())
g.geometry=g.geometry.map(make_valid)
g=g[g.intersects(boundary)].copy()
assert len(g)>0 and g.is_valid.all() and not g.geometry.is_empty.any()
labels=sorted(g.A40_003.unique(),key=lambda s:float(s.split('m')[0]))
colors=['#ffffb2','#fed976','#feb24c','#fd8d3c','#f03b20','#bd0026','#800026','#4d0026']
assert len(labels)<=len(colors)
palette=dict(zip(labels,colors))
g=g.to_crs(4326)
features=[]
for i,row in g.iterrows():
 assert row.geometry.geom_type in ('Polygon','MultiPolygon')
 features.append({'type':'Feature','id':int(i),'geometry':mapping(row.geometry),'properties':{'classLabel':row.A40_003,'color':palette[row.A40_003],'phenomenon':'津波','name':'津波浸水想定（国土数値情報2016年度版）','areaCode':str(i),'datasetYear':2016,'sourceDepthClass':row.A40_003}})
text=json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':'))
for folder in ['public/data','data/processed']:(ROOT/folder/'tsunami.geojson').write_text(text,encoding='utf-8')
report={'file':'A40-16_38_GML.zip','sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/A40/A40-16/A40-16_38_GML.zip','sha256':hashlib.sha256((ROOT/'data/raw/A40-16_38_GML.zip').read_bytes()).hexdigest(),'originalCrs':'EPSG:6668','outputCrs':'EPSG:4326','datasetYear':2016,'catalogReferenceDate':'2016-10-31','downloadedDate':'2026-09-28','count':len(g),'invalidBeforeRepair':invalid,'invalidAfterRepair':int((~g.is_valid).sum()),'selection':'Intersect with Kamijima N03 2026 land polygon. Retain full source polygons; no clipping/simplification. No claim of complete coverage.','legend':[{'label':k,'color':v} for k,v in palette.items()],'classCounts':g.A40_003.value_counts().to_dict(),'bytes':len(text.encode()),'license':'A40 2016 page: redistribution for public disaster prevention/mitigation noncommercial use; newer catalogue lists Ehime open data. Preserve older stricter note.'}
(ROOT/'data/metadata/tsunami-import.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
