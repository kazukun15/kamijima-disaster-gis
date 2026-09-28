import type {FeatureCollection,LineString} from 'geojson';

export interface WalkingNetwork {
 schema:number;sourceDate:string;nodes:[number,number][];edges:[number,number,number][];
}
export interface WalkingResult { lines:FeatureCollection<LineString>;snapMeters:number;segments:number; }
const SPEED_METERS_PER_MINUTE=4000/60;
const MAX_SNAP_METERS=100;
const empty=():FeatureCollection<LineString>=>({type:'FeatureCollection',features:[]});
const rad=(v:number)=>v*Math.PI/180;
export function meters(a:[number,number],b:[number,number]):number{
 const dLat=rad(b[1]-a[1]),dLon=rad(b[0]-a[0]);
 const h=Math.sin(dLat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dLon/2)**2;
 return 12742000*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function projection(point:[number,number],a:[number,number],b:[number,number]){
 const x=Math.cos(rad(point[1]))*111320,y=111320;
 const dx=(b[0]-a[0])*x,dy=(b[1]-a[1])*y;
 const t=Math.max(0,Math.min(1,((point[0]-a[0])*x*dx+(point[1]-a[1])*y*dy)/(dx*dx+dy*dy||1)));
 const snapped:[number,number]=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 return {t,snapped,distance:meters(point,snapped)};
}
function interpolate(a:[number,number],b:[number,number],t:number):[number,number]{return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
class Heap {
 data:[number,number][]=[];
 push(item:[number,number]){let i=this.data.length;this.data.push(item);while(i>0){const p=(i-1)>>1;if(this.data[p][0]<=item[0])break;this.data[i]=this.data[p];i=p;}this.data[i]=item;}
 pop():[number,number]|undefined{const top=this.data[0],last=this.data.pop();if(!this.data.length||!last)return top;let i=0;while(true){let c=i*2+1;if(c>=this.data.length)break;if(c+1<this.data.length&&this.data[c+1][0]<this.data[c][0])c++;if(last[0]<=this.data[c][0])break;this.data[i]=this.data[c];i=c;}this.data[i]=last;return top;}
 get size(){return this.data.length;}
}
export function walkingReach(point:[number,number],minutes:number,network:WalkingNetwork):WalkingResult|null{
 if(!Number.isFinite(minutes)||minutes<1||minutes>60||network.schema!==1||!network.nodes.length||!network.edges.length)return null;
 const nodes=network.nodes,edges=network.edges,budget=minutes*SPEED_METERS_PER_MINUTE;
 let best:{edge:number;t:number;distance:number;snapped:[number,number]}|null=null;
 for(let i=0;i<edges.length;i++){
  const [a,b]=edges[i];if(!nodes[a]||!nodes[b])continue;
  const p=projection(point,nodes[a],nodes[b]);if(!best||p.distance<best.distance)best={edge:i,...p};
 }
 if(!best||best.distance>MAX_SNAP_METERS)return null;
 const adjacency:{to:number;length:number}[][]=Array.from({length:nodes.length},()=>[]);
 const lengths=new Float64Array(edges.length);
 edges.forEach(([a,b,d],i)=>{const length=meters(nodes[a],nodes[b]);lengths[i]=length;if(d>=0)adjacency[a].push({to:b,length});if(d<=0)adjacency[b].push({to:a,length});});
 const distances=new Float64Array(nodes.length).fill(Infinity),queue=new Heap();
 const [startA,startB,startDir]=edges[best.edge],startLength=lengths[best.edge];
 const seed=(index:number,distance:number)=>{if(distance<=budget&&distance<distances[index]){distances[index]=distance;queue.push([distance,index]);}};
 if(startDir<=0)seed(startA,best.distance+best.t*startLength);
 if(startDir>=0)seed(startB,best.distance+(1-best.t)*startLength);
 while(queue.size){const [distance,index]=queue.pop()!;if(distance!==distances[index])continue;for(const next of adjacency[index]){const n=distance+next.length;if(n<=budget&&n<distances[next.to]){distances[next.to]=n;queue.push([n,next.to]);}}}
 const lines=empty();
 const add=(a:[number,number],b:[number,number])=>{if(meters(a,b)>0.5)lines.features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[a,b]}});};
 edges.forEach(([a,b,d],i)=>{
  const length=lengths[i];if(length<0.5)return;
  const left=d>=0?Math.max(0,Math.min(1,(budget-distances[a])/length)):0;
  const right=d<=0?Math.max(0,Math.min(1,(budget-distances[b])/length)):0;
  if(i===best.edge){
   const fromStart=Math.max(0,budget-best.distance)/length;
   // The start lies inside this edge: connect its directly reachable parts.
   if(d<=0)add(interpolate(nodes[a],nodes[b],Math.max(0,best.t-fromStart)),best.snapped);
   if(d>=0)add(best.snapped,interpolate(nodes[a],nodes[b],Math.min(1,best.t+fromStart)));
  }
  if(left+right>=1){add(nodes[a],nodes[b]);return;}
  if(left>0)add(nodes[a],interpolate(nodes[a],nodes[b],left));
  if(right>0)add(interpolate(nodes[a],nodes[b],1-right),nodes[b]);
 });
 return {lines,snapMeters:best.distance,segments:lines.features.length};
}
