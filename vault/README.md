# Vault（Obsidianで開くフォルダ）

このフォルダをObsidianのVaultとして開く。構成:

```
vault/
├── 案件/
│   └── <案件slug>/            # フォルダ名がURLになる（英数字推奨）
│       ├── 案件情報.md         # frontmatterが設定、本文が案件詳細
│       ├── 記事/               # 1記事1ファイル。publishedの日付で集計される
│       └── 知見/               # この案件で得た学び
├── 知見/                       # 全案件共通の知見
└── README.md
```

## 運用ルール

- 新案件 = `案件/<slug>/案件情報.md` を作るだけでダッシュボードにタブが増える
- 記事を書いたら `記事/YYYY-MM-DD-slug.md` を作成（frontmatterに title / url / keyword / published）
- git push でVercelに自動反映
