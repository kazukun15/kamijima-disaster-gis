import {mkdirSync,writeFileSync} from 'node:fs';
import {layers,validateRegistry} from '../lib/registry';
validateRegistry();
mkdirSync('data/metadata',{recursive:true});
writeFileSync('data/metadata/data_catalog.json',JSON.stringify(layers,null,2)+'\n');
writeFileSync('DATA_SOURCES.md','# DATA SOURCES\n\n確認日: 2026-09-28。基準日不明を確認日で代用しません。正本は lib/registry.ts。\n\n'+layers.map(l=>`## ${l.title} (${l.id})\n\n- 配布元: ${l.publisher}\n- URL: ${l.sourceUrl}\n- 公開日: ${l.publishedDate??'未確認'}\n- データ基準日: ${l.effectiveDate??'未確認 / 区域別告示日は属性を参照'}\n- 取得日: ${l.downloadedDate??'直接配信または未取得'}\n- 確認日: ${l.checkedDate}\n- 原典形式: ${l.originalFormat}\n- 原典CRS: ${l.originalCrs}\n- 加工: ${l.processedFormat}\n- ライセンス: ${l.license}\n- 状況: ${l.status}\n- 注意: ${l.notes}\n`).join('\n'));
console.log('Metadata validated and exported.');
