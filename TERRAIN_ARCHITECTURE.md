# KAMIJIMA HYBRID TERRAIN

更新日：2026-09-29。既存のNext.js・MapLibre・PMTilesを維持し、静的ファイルのみで配信します。

## 1. エンジンの選択

| 候補 | 得意な用途 | 今回の判断 |
|---|---|---|
| [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/) | 地図、ラスタDEM、ベクター押出し、既存レイヤーとの統合 | 採用。既存の地点判定・検索・印刷・PMTilesをそのまま使用できる |
| [CesiumJS](https://cesium.com/learn/cesiumjs/ref-doc/Terrain.html) | 地球規模の地形、3D Tiles | 将来の詳細都市モデル向け候補。今回は描画系の置換と二重管理を避ける |
| [Three.js](https://threejs.org/docs/) | 自由な3Dモデル・照明表現 | 将来の個別施設モデル向け。地理座標、タイル管理等の追加実装が必要 |
| [deck.gl TerrainLayer](https://deck.gl/docs/api-reference/geo-layers/terrain-layer) | 地形と分析可視化レイヤー | 将来の大量観測点・時系列向け。現在のデータ量では追加しない |

比較と採否はこのアプリの既存構成に基づく設計判断です。WebGPUは検出結果のみ表示し、動作条件にはしません。

## 2. 公式値と表示用地形

```text
GSI DEM1A → DEM5A → DEM5B → DEM5C → DEM10B
          欠測セルだけを次のソースで充填
                         ↓
 Official Terrain / 元ソースコード / 品質メタデータ
        ├─ 地点標高・勾配補正用の道路節点標高
        └─ 表示用の境界調整・海岸制約・欠測処理
                         ↓
        Visual Terrain-RGB / z10～17 LOD → MapLibre
```

OfficialはGSI配信タイルから選んだ値です。上位DEMの有効セルを下位DEMで上書きしません。粗いソースをz17へ写す際は最近傍参照とし、元解像度を別途保持します。「1m」は原典のグリッド間隔で、全地点の誤差が1m以内という意味ではありません。直接測量した値や行政による認証を意味しません。

OfficialのPNGはGSIの符号付き24bit・cm表現、欠測値0x800000を保持します。VisualはMapbox Terrain-RGB表現で0.1mに量子化。Visual、倍率、建物高さを地点標高に逆流させません。地点取得時はOfficialとsource PNGを読んで値・出典・元解像度・品質区分を返します。町域外や静的タイルの取得失敗時はGSIの実タイルを同じ優先順で確認します。

## 3. 境界と海岸

- 隣接タイルの1セル分を読み、タイルごとに独立した境界計算を避けます。
- DEMソースの境界では、低解像度側に近傍平均との差の35%を反映し、変位を最大±1mに制限します。境界の傾斜差を緩和する局所フェザリングです。DEM1A陸域セルにはこの補正を適用しません。
- 陸域の欠測は、上下左右の3セル以上が有効な小穴だけ近傍平均で表示補間。残る欠測は表示上0m。Officialでは欠測のままです。
- N03行政区域を陸域の代理境界とし、その海側隣接セルを表示上0mに拘束します。陸域外の欠測・負値も0mとします。原典の陸域標高を海岸付近という理由だけで平坦化しません。
- LODはRGBの各バイトではなく、復号した高さを平均して生成します。

これは局所補正です。全境界で傾斜の数学的連続性を保証するものではありません。N03は測量海岸線ではなく、潮位・港湾の精密なbreakline・高潮水面との交差を解決するものでもありません。海岸線の高精度データを導入するときはVisualだけを再生成できます。

## 4. 補間方式の比較と採否

| 方式 | 検討結果 |
|---|---|
| TIN / Natural Neighbor | 不規則な標高点やbreaklineを使う次段階の候補。追加原典と実測による評価が必要 |
| Spline | 滑らかさが得られる一方、海岸や急崖での過大・過小値の管理が必要 |
| Topo to Raster | 水系を考慮する地形再構成の候補。入力の水系・等高線品質と実行環境の整備が必要 |
| 局所近傍補間＋境界制約 | 今回採用。欠測が少ないため、広域地形を新たに推定せず処理範囲を限定できる |

等高線・AW3D30・Copernicus・SRTM・AI超解像は今回使用していません。陸域セルの約98.8%にDEM1A、約99.79%にいずれかのGSI標高があり、異なる基準・年代のデータを無理に混ぜる必要がないためです。残る欠測を正式値として埋めません。比較表は設計上の検討であり、全方式の実データベンチマークではありません。

## 5. 建物・森林・災害

OSM建物をPMTilesへ事前変換し、建物はz12以降に遅延取得、z14以上で押出し（軽量モードz15以上）。遠景は平面表示。全4,306棟が推定高さで、階数×3mまたは用途別3/6mを使用します。建物選択時にEstimatedを表示します。PLATEAUの上島町データは確認できず、採用していません。

森林はOSMの123区域をz11以降に取得し、近景に8mの半透明樹冠を模式表示。初期状態はOFF。個別樹木・実測樹高ではありません。

既存の津波・土砂等のレイヤーは地表へ重ねます。津波の立体表示は浸水深区分の中間値、上限なし区分では下限値を押出し高さとする模式表示です。地点判定は元のポリゴン・属性を使い、水面形状から再計算しません。

## 6. 徒歩分析

道路グラフは30,398節点・31,615辺。最短コスト探索はWeb Workerで実行します。初期値は従来の4km/h。任意で[原著のTobler関数](https://escholarship.org/uc/item/05r820mz)を平地4km/hへ正規化した速度を使用します。

`v = clamp(0.5, 6, 4 × exp(-3.5 × (abs(grade + 0.05) - 0.05)))` km/h

gradeはOfficial標高による節点間標高差/辺長。方向別コストで上り下りを区別します。標高欠測、橋、トンネル、階段、5m未満の辺、絶対勾配50%超は平地コストへ戻し、結果に反映区間数と代替区間数を表示します。長い道路辺の途中の起伏や個人差は表現できません。

## 7. 性能・キャッシュ・障害時

- 地形の生成・融合・建物変換はPythonで事前処理。ブラウザーでは見えるタイルを取得。
- MapLibre標準のタイルLOD・画角外の描画抑制・バッチ描画・Workerを利用。独立した樹木インスタンスや非対応の圧縮テクスチャ形式は追加していません。
- 768px以下またはdeviceMemoryが4GB以下の場合、地形の最大LODをz15に下げ、建物・森林の押出し開始をz15にします。高精細はz17。
- PMTilesはHTTP Rangeとライブラリー・ブラウザーのキャッシュを使用。全ファイルの先行取得はしません。
- Service Workerは画面・JS/CSSを最大80件、取得済みの地形・GeoJSON・GSI画像を最大192件キャッシュ。8MB超のContent-Length、Range、opaque応答は保存対象外。クエリー文字列付き要求も対象外。
- PWAはmanifest・アイコン・オフラインシェルを備えます。未取得範囲・建物Rangeデータの完全オフライン表示は保証しません。ブラウザーが容量不足で削除する場合があります。
- 高精細表示タイル失敗→DEM10B。地形全体の取得失敗→2D。WebGL初期化不可・コンテキスト喪失→HTML画像＋SVGの2D代替地図。
- 標高確認はキャッシュ内のOfficialのみを参照し、Visualの0mから安全性を判定しません。

## 8. ファイルと再生成

| パス | 内容 |
|---|---|
| `scripts/build-terrain.py` | 原典取得・融合・品質集計・Visual/LOD生成 |
| `scripts/validate-terrain.py` | 原典DEM1AとOfficialの照合 |
| `scripts/build-buildings.py` | OSM建物・森林PMTiles生成 |
| `scripts/build-walking-network.py` | OSM道路グラフとOfficial節点標高 |
| `public/data/terrain/official/17/` | 表示加工前の標高 |
| `public/data/terrain/sources/17/` | 各セルの原典コード |
| `public/data/terrain/visual/` | 表示用z10～17 |
| `public/data/terrain/confidence/` | 品質色分けz10～17 |
| `public/data/terrain/metadata.json` | 原典・集計・島・各タイルの内訳 |
| `data/raw/terrain/` | 配信PNG・404記録・HTTP/SHA256監査、公開対象外 |
| `data/processed/terrain/` | 中間配列、公開対象外 |

`pip install -r scripts/requirements.txt` 後、上記生成スクリプトをterrain→validate→buildings→walkingの順に実行します。建物・道路には `data/raw/shikoku-260927.osm.pbf`、地形には公開境界GeoJSONが必要です。配信更新を取り込む際は原本を別日付で保管してキャッシュを切り替え、品質比較・検証を行ってから公開します。

GitHub Pagesでは `NEXT_PUBLIC_BASE_PATH` を全ローカルURL、Worker、manifest、Service Workerに反映。`public/sw.js` のVERSIONは公開データ/画面の更新ごとに変更します。

## 9. 将来拡張

Layer型に任意の開始・終了日メタデータを追加しました。現在は年代選択UI・過去地形の切替はありません。将来の航空写真年代、災害履歴、詳細建物、センサー等は、出典・利用条件・基準日を保持した別レイヤーとして追加できます。解析用Officialと演出用Visualの分離を維持してください。
