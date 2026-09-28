"""Reproducible GIS import. Raw files are never modified. Run from project root.
pip install -r scripts/requirements.txt
python scripts/preprocess.py
"""
import json, hashlib, shutil
from pathlib import Path
import geopandas as gpd
from shapely import make_valid
from shapely.geometry import mapping

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data/raw'; OUT=ROOT/'data/processed'; PUBLIC=ROOT/'public/data'
OUT.mkdir(exist_ok=True); PUBLIC.mkdir(parents=True,exist_ok=True)
reports=[]
def save(name,features):
    text=json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':'))
    (OUT/f'{name}.geojson').write_text(text,encoding='utf-8')
    shutil.copyfile(OUT/f'{name}.geojson',PUBLIC/f'{name}.geojson')
def validated(g,name):
    if g.crs is None: raise ValueError(f'{name}: CRS missing. Obtain authoritative CRS; do not infer.')
    null=int(g.geometry.isna().sum()); invalid=int((~g.geometry.is_valid).sum())
    duplicates=int(g.geometry.to_wkb().duplicated().sum())
    reports.append({'dataset':name,'originalCrs':str(g.crs),'count':len(g),'null':null,'invalid':invalid,'duplicates':duplicates})
    if null: raise ValueError(f'{name}: null geometry')
    g=g.copy();g.geometry=g.geometry.map(make_valid)
    if not g.geometry.is_valid.all(): raise ValueError('Unrepaired geometry')
    return g.to_crs(4326)

boundary=gpd.read_file(next((RAW/'boundary-2026').glob('*.shp')))
boundary=validated(boundary[boundary.N03_007=='38356'],'boundary')
town=boundary.geometry.union_all()
save('boundary',[{'type':'Feature','properties':{'name':'上島町','municipalityCode':'38356'},'geometry':mapping(town)}])
for suffix,name,label in [('y','landslide-warning','土砂災害警戒区域'),('r','landslide-special','土砂災害特別警戒区域')]:
    g=validated(gpd.read_file(next((RAW/'landslide').glob(f'keikai_{suffix}_*.shp'))),name)
    if set(g.SHIKUCHOSO)!= {'越智郡上島町'}:raise ValueError('Unexpected municipality')
    reports[-1]['outsideBoundaryFeatures']=int((~g.geometry.within(town)).sum())
    reports[-1]['outsideBoundaryPolicy']='Retain officially selected town features; flag coastline/boundary differences, do not silently clip official designation.'
    features=[]
    for index,row in g.iterrows():
        if row.geometry.geom_type not in ['Polygon','MultiPolygon']:raise ValueError('Unexpected geometry after repair')
        features.append({'type':'Feature','id':int(index),'geometry':mapping(row.geometry),'properties':{'classLabel':label,'phenomenon':row.SHIZEN_NAM,'name':row.KUIKI_NAME,'areaCode':row.KUIKI_NUMB,'address':row.CHIMEI,'noticeDate':str(row.KOKUJI_YMD)[:10]}})
    save(name,features)

# Match the whole municipality, not the substring in Hiroshima's 大崎上島町.
for name,kinds in [('emergency',[f'skhb{i:02}' for i in range(1,9)]),('shelter',['sih'])]:
    unique={}
    for kind in kinds:
        for f in json.loads((RAW/f'{kind}-kamijima.json').read_text(encoding='utf-8')):
            props=f['properties']
            if not props.get('address','').startswith(('愛媛県越智郡上島町','愛媛県上島町')):continue
            allowed=['name','address']+[f'disaster{i}' for i in range(1,9)]
            f['properties']={k:props[k] for k in allowed if k in props}
            key=(props['name'],*f['geometry']['coordinates']);unique[key]=f
    if not unique:raise ValueError(f'No {name} facilities retrieved')
    save(name,list(unique.values()))
    reports.append({'dataset':name,'count':len(unique),'municipalityFilter':'愛媛県(?:越智郡)?上島町','privacy':'Only public facility name, address and disaster flags retained'})

# Inspect only; refuse cadastral publication when CRS is absent.
cad=[]
for p in (RAW/'cadastral').rglob('*.shp'):
    g=gpd.read_file(p)
    fields=list(g.drop(columns='geometry').columns)
    if any(any(word in field for word in ['所有者','納税','氏名','課税','電話']) for field in fields):raise ValueError('Potential personal information; publication stopped')
    cad.append({'file':p.name,'count':len(g),'fields':fields,'crs':str(g.crs),'encoding':p.with_suffix('.cpg').read_text(),'status':'DATA_SOURCE_PENDING' if g.crs is None else 'REVIEW_REQUIRED'})
(ROOT/'data/metadata/cadastral-inspection.json').write_text(json.dumps(cad,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'data/metadata/validation-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
manifest=[{'file':str(p.relative_to(RAW)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in RAW.rglob('*') if p.is_file()]
(ROOT/'data/metadata/raw-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(reports,ensure_ascii=False,indent=2))
