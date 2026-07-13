# SEOダッシュボード（案件別・GSC連携・Obsidian一体型）

複数案件のSEO成果を1つのWebダッシュボードで管理する。
データの実体はすべて `vault/`（＝Obsidian Vault）のMarkdown。ノートを書いてgit pushすれば画面に反映される。

## 機能

- 全体サマリー＋案件ごとのタブ、画面からの案件追加（GitHub自動コミット）
- 週 / 月 / 全期間の切り替えレポート（クリック・表示回数・CTR・平均順位・記事作成数・前期間比）
- **記事×検索データ分析**: 記事一覧にGSC実測値を結合。記事ごとの詳細ページで流入クエリを確認
- **リライト候補の自動判定**: 「主力」（表示回数シェア30%以上→強化）「あと一歩」（4〜15位→上位化）「タイトル改善」（順位のわりにCTR低）「下落」（クリック30%減）
- **順位監視の自動化**: 毎週月曜9時にピラーKW順位を自動記録、履歴テーブル表示、下落時Slack通知
- **週次レポート自動生成**: `vault/案件/<slug>/レポート/` にMDで自動コミット→Obsidianに知見が貯まる
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
| `GITHUB_REPO` | `ユーザー名/リポジトリ名`（画面から案件追加・週次自動記録に必要） |
| `GITHUB_TOKEN` | Fine-grained PAT（下記手順で発行） |
| `CRON_SECRET` | 週次バッチ保護用のランダム文字列（好きな長い文字列でOK） |
| `SLACK_WEBHOOK_URL` | （任意）順位下落アラートの通知先Slack Webhook |

### GITHUB_TOKEN の発行（画面から案件追加する場合）

1. GitHub → 右上アイコン → Settings → 左メニュー最下部 **Developer settings**
2. **Personal access tokens → Fine-grained tokens → Generate new token**
3. Repository access: **Only select repositories** → このリポジトリを選択
4. Permissions → Repository permissions → **Contents: Read and write**
5. Generate → トークンをコピーしてVercelの `GITHUB_TOKEN` に設定

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

## 週次バッチ（順位監視・レポート）

`vercel.json` のcron設定で毎週月曜9時（JST）に `/api/cron/weekly` が自動実行される。

- 各案件のピラーKW順位を `vault/案件/<slug>/データ/rank-history.json` に記録（52週保持）
- 週次レポートを `vault/案件/<slug>/レポート/YYYY-Www.md` にコミット
- 前週から2位以上下落したKWがあればSlackに通知
- 手動実行（テスト用）: ブラウザで `https://<あなたのURL>/api/cron/weekly?key=<CRON_SECRET>` を開く

※ コミット→Vercelの自動デプロイが走るので、履歴はダッシュボードにも自動反映される。

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
