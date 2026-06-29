# japan-transit-mcp

言語: [English](README.md) | [日本語](README.ja.md)

<https://api.transit.ls8h.com/> の公開 Transit API を利用する、日本の乗り換え検索向け MCP サーバです。

これは公開・読み取り専用の Transit API を呼び出す非公式のクライアント/サーバラッパーです。Transit、交通事業者、ODPT、その他のデータ提供者による公式・承認・保証されたものではありません。

## セットアップ

```bash
npm install
npm run build
```

## MCP 設定

ビルド済みの stdio サーバを使います。

```json
{
  "mcpServers": {
    "japan-transit": {
      "command": "node",
      "args": ["/path/to/japan-transit-mcp/dist/index.js"]
    }
  }
}
```

`/path/to/japan-transit-mcp` は、自分の環境にあるチェックアウト先のパスに置き換えてください。

開発中は次のコマンドでも起動できます。

```bash
npm run dev
```

## ツール

- `suggest_places`: 駅、停留所、施設、住所を検索します。返却される `endpoint` を経路検索に使います。
- `suggest_stations`: 駅・停留所 ID のみを検索します。
- `reverse_places`: 緯度経度から近くの経路検索用 endpoint を探します。
- `plan_route`: 出発、到着、始発、終電の経路を検索します。
- `guidance_plan`: 戦略や追跡オプション付きで、順位付けされた案内候補を検索します。
- `get_station`: 駅の詳細、ホーム、乗り入れ路線を取得します。
- `station_departures`: データライセンス上許可される場合に、駅の発車案内を取得します。
- `list_feeds`: 収載フィードと出典・ライセンス情報を一覧します。
- `list_operators`: 事業者のブランド表示とロゴ/データライセンス情報を一覧します。
- `health`: Transit API の疎通を確認します。

経路検索の endpoint には、`feedId:stopId` 形式の駅 ID または `geo:35.680960,139.766386` のような地理座標 endpoint を指定できます。

## 利用例

1. `suggest_places` に `q: "東京駅"` を指定して呼び出します。
2. `suggest_places` に `q: "新宿駅"` を指定して呼び出します。
3. 返却された `endpoint` を `plan_route` に渡します。

API が返す時刻は、レスポンスのタイムゾーンにおけるサービス日 0 時からの秒数です。深夜以降の運行では `86400` を超える場合があります。

## 規約、出典、信頼性

この MCP サーバを公開または運用する前に、Transit の利用規約 <https://transit.ls8h.com/terms> を確認してください。

- Transit API は無償・認証なし・読み取り専用ですが、過度なリクエスト、サービス運用を妨げる利用、第三者の権利や利用条件を害する利用、公式サービスであるかのように誤認させる表示は禁止されています。
- Transit のデータは、GTFS、ODPT、交通事業者、自治体、OpenStreetMap、国土地理院、PLATEAU、その他の第三者ソースに由来する場合があります。各出典のライセンスと帰属表示条件を尊重してください。
- 経路、時刻、運賃、徒歩、場所、地図、出典データの正確性、完全性、最新性、可用性、特定目的への適合性は保証されません。
- API の結果を表示するアプリケーションでは、このサービスが非公式であり、重要な移動判断や業務判断では公式情報を確認すべきことを明示してください。
- このリポジトリの MIT ライセンスは、この MCP ラッパーのコードのみに適用されます。Transit API のレスポンス、事業者のマーク/ロゴ、時刻表データ、OpenStreetMap データ、ODPT データ、その他の第三者コンテンツへの権利を許諾するものではありません。

出典とライセンス情報の取得には `list_feeds` と `list_operators` を使ってください。特に ODPT 由来データについて、API レスポンスから大規模な時刻表再配布サービスを構築することは避けてください。
