"""Fetch dated snapshots; never overwrites a different original. Run from project root.
Review official terms before acquisition/publication. No automatic publish.
"""
from pathlib import Path
import urllib.request,urllib.parse,urllib.error,re,html,json,zipfile,hashlib
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'data/raw';RAW.mkdir(parents=True,exist_ok=True)
def fetch(url,path):
    if path.exists():return path.read_bytes()
    b=urllib.request.urlopen(url,timeout=90).read()
    with path.open('xb') as f:f.write(b)
    return b
def extract(path,directory):
    directory.mkdir(exist_ok=True)
    with zipfile.ZipFile(path) as z:
        for member in z.infolist():
            target=(directory/member.filename).resolve()
            if not target.is_relative_to(directory.resolve()):raise ValueError('Unsafe ZIP path')
            if member.is_dir():target.mkdir(parents=True,exist_ok=True);continue
            b=z.read(member);target.parent.mkdir(parents=True,exist_ok=True)
            if target.exists():
                if target.read_bytes()!=b:raise ValueError('Raw overwrite refused')
            else:target.write_bytes(b)
fetch('https://www.town.kamijima.lg.jp/uploaded/attachment/7800.zip',RAW/'cadastral-20260101.zip')
extract(RAW/'cadastral-20260101.zip',RAW/'cadastral')
fetch('https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2026/N03-20260101_38_GML.zip',RAW/'boundary-2026.zip')
extract(RAW/'boundary-2026.zip',RAW/'boundary-2026')
if not (RAW/'landslide-download').exists():
    url='https://www.sabo.pref.ehime.jp/map/GisDownload.aspx'
    s=urllib.request.urlopen(url,timeout=30).read().decode('utf-8')
    fields={name:html.unescape(value) for name,value in re.findall(r'<input type="hidden" name="([^"]+)"[^>]*value="([^"]*)"',s)}
    # Fields inspected on 2026-09-28. Fail closed if the municipality mapping changes.
    if not re.search(r'id="cphContents_ShikuchosonList_11"[^>]*value="12"',s) or not re.search(r'for="cphContents_ShikuchosonList_11">越智郡上島町',s):raise ValueError('Download form changed; inspect before proceeding')
    fields.update({'__EVENTTARGET':'ctl00$cphContents$btnDownload','__EVENTARGUMENT':'','ctl00$cphContents$DownLoad':'Keikai','ctl00$cphContents$KeikaiDoseki':'on','ctl00$cphContents$KeikaiKyukei':'on','ctl00$cphContents$KeikaiJisuberi':'on','ctl00$cphContents$Area':'Shikuchoson','ctl00$cphContents$ShikuchosonList$11':'12','ctl00$cphContents$DataFormat':'shp'})
    b=urllib.request.urlopen(url,urllib.parse.urlencode(fields).encode(),timeout=90).read()
    if not b.startswith(b'PK'):raise ValueError('Expected ZIP')
    (RAW/'landslide-download').write_bytes(b)
extract(RAW/'landslide-download',RAW/'landslide')
for kind in [f'skhb{i:02}' for i in range(1,9)]+['sih']:
    selected=[]
    for x in range(889,893):
        for y in range(406,410):
            url=f'https://cyberjapandata.gsi.go.jp/xyz/{kind}/10/{x}/{y}.geojson';p=RAW/f'{kind}-10-{x}-{y}.geojson'
            try:
                b=fetch(url,p);j=json.loads(b)
                selected += [f for f in j['features'] if f.get('properties',{}).get('address','').startswith(('愛媛県上島町','愛媛県越智郡上島町'))]
            except urllib.error.HTTPError as e:
                if e.code!=404:raise
    # Derived extraction is re-created separately; original tile responses are immutable.
    p=RAW/f'{kind}-kamijima.json'
    if not p.exists():p.write_text(json.dumps(selected,ensure_ascii=False),encoding='utf-8')
print('Acquisition complete. Run preprocess.py; publication remains a separate review step.')
