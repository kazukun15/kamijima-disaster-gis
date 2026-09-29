from pathlib import Path
import json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1];base=root/'public/data/terrain';meta=json.loads((base/'metadata.json').read_text(encoding='utf-8'))
assert len({tuple(i['center']) for i in meta['islands']})==len(meta['islands'])
cells=0
for key in meta['officialTiles']:
 rgb=np.array(Image.open(base/f'official/{key}.png'));source=np.array(Image.open(base/f'sources/{key}.png'))
 missing=(rgb[:,:,0]==128)&(rgb[:,:,1]==0)&(rgb[:,:,2]==0)
 assert np.array_equal(missing,source==0),key
 assert source.max()<=5,key
 raw=root/f'data/raw/terrain/dem1a_png/{key}.png'
 if raw.exists():
  original=np.array(Image.open(raw).convert('RGB'));selected=source==1
  assert np.array_equal(original[selected],rgb[selected]),key
  cells+=int(selected.sum())
 assert (base/f'visual/{key}.png').exists()
 z,x,y=key.split('/');tmp=np.load(root/f'data/processed/terrain/{x}-{y}.npz');land=tmp['m']
 visual=np.array(Image.open(base/f'visual/{key}.png')).astype(np.int64)
 height=(visual[:,:,0]*65536+visual[:,:,1]*256+visual[:,:,2])*.1-10000
 preserved=land&(source==1)
 assert np.max(np.abs(height[preserved]-tmp['h'][preserved]),initial=0)<=.051,key
 # Interior pixels avoid needing the neighboring tile's mask for this assertion.
 coast=(~land[1:-1,1:-1])&(land[1:-1,:-2]|land[1:-1,2:]|land[:-2,1:-1]|land[2:,1:-1])
 assert np.all(np.abs(height[1:-1,1:-1][coast])<.001),key
print(json.dumps({'officialTiles':len(meta['officialTiles']),'visualTiles':len(meta['visualTiles']),'unalteredDEM1ACellsChecked':cells,'islands':len(meta['islands']),'status':'PASS'}))
