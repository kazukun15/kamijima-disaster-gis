/** Illustrative class representative only. Not a water surface or hydraulic model. */
export function illustrativeDepth(label:string):number|null{
 const values=label.normalize('NFKC').match(/\d+(?:\.\d+)?/g)?.map(Number)??[];
 if(!values.length)return null;
 const h=values.length>=2?(values[0]+values[1])/2:values[0];
 return Number.isFinite(h)&&h>=0&&h<=100?h:null;
}
