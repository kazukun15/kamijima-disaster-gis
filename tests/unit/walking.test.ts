import {describe,it,expect} from 'vitest';
import {walkingReach,slopeWalkingSpeed,type WalkingNetwork} from '../../lib/walking';

// About 111 m between neighboring coordinates at the equator.
const network:WalkingNetwork={schema:1,sourceDate:'test',nodes:[[0,0],[0.001,0],[0.002,0],[0.001,0.001],[0.003,0]],edges:[[0,1,0],[1,2,0],[3,4,0]]};
describe('Walking road network',()=>{
 it('stays on connected streets and never jumps to a separate island',()=>{
  const result=walkingReach([0,0],10,network)!;
  expect(result.segments).toBeGreaterThan(0);
  expect(result.lines.features.every(f=>f.geometry.coordinates.every(([,lat])=>lat===0))).toBe(true);
 });
 it('draws a partial road when time ends inside an edge',()=>{
  const result=walkingReach([0,0],1,network)!;
  const maximum=Math.max(...result.lines.features.flatMap(f=>f.geometry.coordinates.map(([lon])=>lon)));
  expect(maximum).toBeGreaterThan(0.0005);
  expect(maximum).toBeLessThan(0.001);
 });
 it('respects pedestrian one-way direction from an interior start',()=>{
  const oneWay={...network,edges:[[0,1,1]] as [number,number,number][]};
  const result=walkingReach([0.0005,0],10,oneWay)!;
  expect(result.lines.features.every(f=>f.geometry.coordinates.every(([lon])=>lon>=0.0005-0.000001))).toBe(true);
 });
 it('rejects a start far from any mapped walking road',()=>expect(walkingReach([0.01,0.01],15,network)).toBeNull());
 it('rejects invalid time values',()=>expect(walkingReach([0,0],61,network)).toBeNull());
 it('keeps flat speed at 4 km/h and distinguishes uphill from downhill',()=>{expect(slopeWalkingSpeed(0)).toBeCloseTo(4);expect(slopeWalkingSpeed(.1)).toBeLessThan(slopeWalkingSpeed(-.1));});
 it('reduces uphill reach and labels missing elevation fallbacks',()=>{
  const uphill:WalkingNetwork={...network,edges:[[0,1,0],[1,2,0]],elevations:[0,20,null],edgeTerrain:[true,true]};
  const flat=walkingReach([0,0],1,uphill,'flat')!,slope=walkingReach([0,0],1,uphill,'slope')!;
  const far=(r:typeof flat)=>Math.max(...r.lines.features.flatMap(f=>f.geometry.coordinates.map(c=>c[0])));
  expect(far(slope)).toBeLessThan(far(flat));expect(slope.slopeAppliedEdges).toBe(1);
  expect(walkingReach([0,0],10,uphill,'slope')!.slopeFallbackEdges).toBe(1);
 });
 it('does not apply ground DEM slopes to bridge edges',()=>{const bridge:WalkingNetwork={...network,edges:[[0,1,0]],elevations:[0,30],edgeTerrain:[false]};expect(walkingReach([0,0],2,bridge,'slope')!.slopeAppliedEdges).toBe(0);});
});
