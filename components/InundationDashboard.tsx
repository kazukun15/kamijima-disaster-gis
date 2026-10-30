'use client';
/* eslint-disable @next/next/no-img-element */
import {stateLabels} from '@/lib/analysis';
import type {HazardResult, Layer} from '@/lib/types';

type Props = {
  layers: Layer[];
  activeLayers: string[];
  results: Record<string, HazardResult>;
  selectedPoint: [number, number] | null;
  loading: string[];
  errors: string[];
  onShow: (id: string) => void;
  onClose: () => void;
  onSource: (id: string) => void;
  onSelectCenter: () => void;
};

const explanations: Record<string, string> = {
  tsunami: '2016年度版の想定区域です。最新の県想定とは時点が異なります。区域に図形が見つからない場合も、安全とは判定できません。',
  flood: '原典の画像を地図に表示します。上島町の収録を確認できておらず、地点判定はできません。',
  surge: '原典の画像を地図に表示します。上島町付近の配信を確認できておらず、地点判定はできません。',
};

export default function InundationDashboard({layers, activeLayers, results, selectedPoint, loading, errors, onShow, onClose, onSource, onSelectCenter}: Props) {
  const waterLayers = ['tsunami', 'flood', 'surge'].flatMap(id => {
    const layer = layers.find(item => item.id === id);
    return layer ? [layer] : [];
  });

  return <aside id="inundation-dashboard" className="flood-dashboard" aria-labelledby="flood-dashboard-title">
    <div className="flood-dashboard-header">
      <div><p className="flood-dashboard-eyebrow">INUNDATION DASHBOARD</p><h2 id="flood-dashboard-title">浸水ダッシュボード</h2></div>
      <button type="button" onClick={onClose} aria-label="浸水ダッシュボードを閉じる">閉じる ×</button>
    </div>
    <div className="flood-dashboard-body">
      <p className="flood-dashboard-intro">津波・洪水・高潮の想定を、それぞれの地図と地点情報で確認できます。「地図に表示」を押すと水害レイヤーを切り替えます。</p>
      <p className="flood-dashboard-notice">各データは想定条件や時点が異なります。重ね合わせは複合浸水の計算結果ではなく、深さを足し合わせることもできません。現在の浸水状況を示すものではありません。</p>
      <section className="flood-dashboard-point" aria-label="地点の選択">
        <h3>確認する地点</h3>
        {selectedPoint ? <p>緯度 {selectedPoint[1].toFixed(6)}、経度 {selectedPoint[0].toFixed(6)}</p> : <p>地図上を選ぶか、地図の中央を指定してください。</p>}
        <button type="button" onClick={onSelectCenter}>地図の中央を調べる</button>
      </section>
      <div className="flood-dashboard-cards">
        {waterLayers.map(layer => {
          const active = activeLayers.includes(layer.id);
          const result = results[layer.id];
          const isLoading = loading.includes(layer.id) || loading.includes('boundary');
          const hasError = errors.includes(layer.id) || errors.includes('boundary');
          return <section className="flood-dashboard-card" key={layer.id} aria-labelledby={`flood-dashboard-${layer.id}`}>
            <div className="flood-dashboard-card-heading"><h3 id={`flood-dashboard-${layer.id}`}>{layer.title}</h3><span>{active ? '地図に表示中' : '地図は非表示'}</span></div>
            <p className="flood-dashboard-date">データ基準日：{layer.effectiveDate ?? '未確認'}{layer.id === 'tsunami' ? '（2016年度版）' : ''}</p>
            <p>{explanations[layer.id]}</p>
            {layer.id === 'flood' && <p className="flood-dashboard-rivers">県は小漕川・長江川・船越川・引野川・沢津川の想定図を公表しています（2026年3月31日指定）。<a href="https://www.pref.ehime.jp/site/kouzuishinsusoutei/141959.html" target="_blank" rel="noreferrer">県の公式図を開く ↗</a></p>}
            <div className="flood-dashboard-card-actions"><button type="button" aria-pressed={active} onClick={() => onShow(layer.id)}>{active ? '地図から非表示' : '地図に表示'}</button><button type="button" onClick={() => onSource(layer.id)}>出典・詳細</button></div>
            <div className="flood-dashboard-result" aria-live="polite">
              <strong>選択地点の判定</strong>
              {!selectedPoint ? <p>地点を選択してください。</p> : isLoading ? <p>判定データを読み込み中です。</p> : hasError ? <p>{layer.kind === 'raster' ? '表示用タイルを取得できない箇所があります。画像による地点判定はできません。' : '判定データを取得できません。通信状態を確認してください。'}</p> : result ? <><p>{stateLabels[result.state]}</p>{result.classLabel && <p>{result.classLabel}</p>}<p>{result.reason}</p></> : <p>判定データがありません。</p>}
            </div>
            <details className="flood-dashboard-legend"><summary>凡例を見る</summary>{layer.legendUrl ? <><img src={layer.legendUrl} alt={`${layer.title}の原典凡例（浸水深）`} loading="lazy"/><a href={layer.sourceUrl} target="_blank" rel="noreferrer">原典を確認 ↗</a></> : <div>{layer.legend.map(item => <span key={item.label}><i style={{backgroundColor:item.color}} aria-hidden="true"/>{item.label}</span>)}</div>}</details>
          </section>;
        })}
      </div>
      <p className="flood-dashboard-note">未着色・データなしは安全を意味しません。避難時は町・県・気象庁の最新情報を確認してください。</p>
      <p className="flood-dashboard-links"><a href="https://www.pref.ehime.jp/site/kouzuishinsusoutei/141959.html" target="_blank" rel="noreferrer">愛媛県の洪水浸水想定図 ↗</a><a href="https://experience.arcgis.com/experience/4f891230727d4c0b9689eb9d8cf98da9/page/Home?views=Inundation" target="_blank" rel="noreferrer">参考：NOAA Mobile Bay ダッシュボード ↗</a><a href="https://coastalscience.noaa.gov/news/new-insights-into-compound-flood-risk-in-the-mobile-bay-area/" target="_blank" rel="noreferrer">NOAA の取組の説明 ↗</a></p>
    </div>
  </aside>;
}
