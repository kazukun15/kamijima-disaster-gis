"""Join reviewed plan records and position matches; never infer shelter designations.
Inputs: data/raw/facilities/{plan-catalog,position-matches}.json.
Public facility-plan.json retains all records, including unlocated facilities.
"""
from pathlib import Path
import json,re,unicodedata
root=Path(__file__).resolve().parents[1];raw=root/'data/raw/facilities';out=root/'public/data'
if (raw/'plan-catalog.json').exists() and (raw/'position-matches.json').exists():
 plans=json.loads((raw/'plan-catalog.json').read_text(encoding='utf-8'));positions=json.loads((raw/'position-matches.json').read_text(encoding='utf-8'))
else:
 # The published catalog preserves reviewed source records and position provenance.
 plans=json.loads((out/'facility-plan.json').read_text(encoding='utf-8'))['facilities']
 positions={p['id']:p['position'] for p in plans if p.get('position')}
def norm(text):
 s=unicodedata.normalize('NFKC',text);s=re.sub(r'\([^)]*\)|[\s「」]','',s)
 s=re.sub(r'^上島町立|^上島町','',s)
 return re.sub(r'(体育館|グラウンド|グランド|運動場)$','',s)
features=[]
for plan in plans:
 pos=positions.get(plan['id']);plan['position']=pos
 if not pos:continue
 features.append({'type':'Feature','geometry':{'type':'Point','coordinates':pos['coordinates']},'properties':{'name':plan['name'],'address':pos.get('address',''),'plan':plan,'positionSource':pos['source'],'positionDate':pos.get('guideDate','2026-09-27/28取得'),'positionNote':'施設案内地図・施設点の代表位置。敷地境界や入口の測量位置ではありません。'}})
(out/'public-facilities.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'facility-plan.json').write_text(json.dumps({'source':'https://www.town.kamijima.lg.jp/uploaded/life/19667_70461_misc.pdf','planDate':'2021-03','facilities':plans,'mapped':len(features)},ensure_ascii=False,indent=2),encoding='utf-8')
matched={}
for layer in ['emergency','shelter']:
 p=out/(layer+'.geojson');data=json.loads(p.read_text(encoding='utf-8'));count=0
 for f in data['features']:
  prop=f['properties'];prop.pop('plan',None);prop.pop('plans',None)
  name=norm(prop['name']);found=[]
  for plan in plans:
   pos=positions.get(plan['id'])
   names={norm(plan['name'])}
   if pos:names.add(norm(pos['name']))
   if name in names:found.append(plan)
  if found:
   if len(found)==1:prop['plan']=found[0]
   else:prop['plans']=found
   count+=1
 p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8');matched[layer]=count
print(json.dumps({'planFacilities':len(plans),'buildings':sum(len(p['buildings']) for p in plans),'mapped':len(features),'enriched':matched},ensure_ascii=False))
