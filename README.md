# SEOダッシュボード（案件別・GSC連携・Obsidian一体型）

複数案件のSEO成果を1つのWebダッシュボードで管理する。
データの実体はすべて `vault/`（＝Obsidian Vault）のMarkdown。ノートを書いてgit pushすれば画面に反映される。

## 機能

- 全体サマリー＋案件ごとのタブ
- 週 / 月 / 全期間の切り替えレポート（クリック・表示回数・CTR・平均順位・記事作成数）
- 検索ワードTOP20（順位の色分け: 1〜3位緑、4〜10位オレンジ）
- 人気ページTOP10、記事一覧、案件詳細・講師情報、知見ノート
- Basic認証（環境変数で有効化）

## セットアップ

### 1. Search Console API（1回だけ）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. 「APIとサービス」→「ライブラリ」→ **Google Search Console API** を有効化
3. 「認証情報」→ サービスアカウント作成 → キー（JSON）を発行してダウンロード
4. **各案件のSearch Console** → 設定 → ユーザーと権限 → サービスアカウントのメールアドレス
   （`xxx@xxx.iam.gserviceaccount.com`）を「制限付き」以上で追加
   ※ 新しい案件を増やすときはこの手順4だけ繰り返す

### 2. デプロイ（Vercel）

1. このフォルダをGitHubリポジトリにpush
2. [Vercel](https://vercel.com/) でリポジトリをインポート（設定はデフォルトでOK）
3. 環境変数を設定:

| 変数 | 値 |
|---|---|
| `GSC_SERVICE_ACCOUNT_JSON` | ダウンロードしたJSONキーの**中身全文** |
| `DASHBOARD_USER` | ダッシュボードのログインID |
| `DASHBOARD_PASS` | パスワード（クライアントデータを扱うので必須） |

### 3. Obsidian

`vault/` フォルダをObsidianでVaultとして開く。詳細は `vault/README.md`。

## 案件の追加

```
vault/案件/<slug>/案件情報.md   ← sampleをコピーして編集
```

frontmatterの `gsc_site` にGSCプロパティを指定
（ドメインプロパティ: `sc-domain:example.com` / URLプレフィックス: `https://example.com/`）。
これだけでナビにタブが増える。

## 記事の記録

```
vault/案件/<slug>/記事/YYYY-MM-DD-slug.md
```

frontmatter: `title` / `url` / `keyword` / `published` / `status`。
`published` の日付で週・月の記事作成数が集計される。

## ローカル開発

```
npm install
npm run dev   # http://localhost:3000
```

環境変数はプロジェクト直下の `.env.local` に書く（gitignore済み）。

## 注意

- GSCのデータは約2日遅れ。全期間タブはGSC APIの保持上限（約16ヶ月）まで
- GSC APIレスポンスは1時間キャッシュされる
- `DASHBOARD_USER/PASS` 未設定だと認証なしで公開されるので本番では必ず設定
