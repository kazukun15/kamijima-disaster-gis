import type {MetadataRoute} from 'next';
import {assetUrl} from '@/lib/asset-url';
export const dynamic='force-static';
export default function manifest():MetadataRoute.Manifest{return {name:'KAMIJIMA 3D — 上島町 統合防災WebGIS',short_name:'KAMIJIMA 3D',description:'地形・防災情報・徒歩到達範囲を確認する上島町の立体地図',lang:'ja',start_url:assetUrl('/'),scope:assetUrl('/'),display:'standalone',background_color:'#eef3f1',theme_color:'#176f67',icons:[{src:assetUrl('/icon.svg'),sizes:'any',type:'image/svg+xml',purpose:'any'}]};}
