/** Prefix only local public assets; external official tile URLs stay unchanged. */
export function assetUrl(url:string,base=process.env.NEXT_PUBLIC_BASE_PATH??''):string{
 return url.startsWith('/')&&!url.startsWith('//')?`${base.replace(/\/$/,'')}${url}`:url;
}
