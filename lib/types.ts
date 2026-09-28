import type { FeatureCollection, Polygon, MultiPolygon, Point } from 'geojson';
export type HazardState = 'APPLICABLE' | 'NOT_APPLICABLE' | 'NO_DATA' | 'NOT_CHECKED' | 'OUT_OF_COVERAGE';
export type Area = FeatureCollection<Polygon | MultiPolygon>;
export type Facilities = FeatureCollection<Point>;
export type Category = 'EARTHQUAKE' | 'WATER' | 'LANDSLIDE' | 'BASE' | 'FACILITY';
export interface Metadata {
  id:string; title:string; publisher:string; sourceUrl:string; publishedDate:string|null;
  effectiveDate:string|null; downloadedDate:string|null; checkedDate:string; license:string;
  originalFormat:string; originalCrs:string; processedFormat:string; notes:string;
}
export interface Layer extends Metadata {
  category:Category; hazardKind?:string; status:'READY'|'DISPLAY_ONLY'|'DATA_SOURCE_PENDING';
  kind:'polygon'|'raster'|'point'|'pending'|'pmtiles'; url?:string; color:string;
  legend: {label:string;color:string}[]; legendUrl?:string; minzoom?:number;
  coverageVerified?:boolean; sourceLayer?:string;
}
export interface HazardResult { state:HazardState; classLabel?:string; reason:string; matches:number; areas?:{name:string;phenomenon:string;noticeDate:string;areaCode:string}[]; }
export interface ViewState {lat:number;lng:number;zoom:number;layers:string[];scenario:string;basemap:"map"|"photo";terrain:boolean;}
