import {walkingReach,type WalkingNetwork,type WalkingMode} from './walking';
let network:WalkingNetwork|null=null;
self.onmessage=(event:MessageEvent<{request:number;point:[number,number];minutes:number;mode:WalkingMode;network?:WalkingNetwork}>)=>{
 const data=event.data;
 try{if(data.network)network=data.network;if(!network)throw Error('Missing road network');self.postMessage({request:data.request,minutes:data.minutes,result:walkingReach(data.point,data.minutes,network,data.mode)});}
 catch{self.postMessage({request:data.request,error:'歩行道路網の計算を完了できませんでした。'});}
};
