import { createProject } from "./actions";
import { githubEnabled, serviceAccountEmail } from "@/lib/github";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  slug: "IDは英小文字・数字・ハイフンのみで入力してください。",
  name: "案件名は必須です。",
  exists: "そのIDの案件はすでに存在します。別のIDにしてください。",
  github: "GitHubへの保存に失敗しました。GITHUB_TOKENの権限を確認してください。",
  config: "環境変数 GITHUB_REPO / GITHUB_TOKEN が未設定です（README参照）。",
};

export default function NewProject({
  searchParams,
}: {
  searchParams: { done?: string; error?: string };
}) {
  const saEmail = serviceAccountEmail();

  if (searchParams.done) {
    return (
      <main>
        <h1>案件を追加しました</h1>
        <p className="sub">ID: {searchParams.done}</p>
        <div className="card" style={{ maxWidth: 640 }}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            ✅ リポジトリにコミットしました。<b>1〜2分後</b>（再デプロイ完了後）にタブへ反映されます。
          </p>
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            📊 アクセスデータを表示するには、この案件のSearch Consoleに以下を
            ユーザー追加（権限: 制限付き）してください:
          </p>
          <p style={{ fontSize: 13, background: "var(--bg)", padding: "8px 12px", borderRadius: 8 }}>
            <code>{saEmail || "（GSC_SERVICE_ACCOUNT_JSON未設定）"}</code>
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>
            詳細情報・記事・知見の追記は、Obsidian（vault/案件/{searchParams.done}/）
            またはGitHub上で編集できます。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>案件を追加</h1>
      <p className="sub">
        保存するとGitHubにコミットされ、再デプロイ後（1〜2分）にタブへ反映されます
      </p>

      {searchParams.error && (
        <div className="notice">⚠️ {ERRORS[searchParams.error] || "エラーが発生しました。"}</div>
      )}
      {!githubEnabled() && (
        <div className="notice">
          ⚠️ この機能には環境変数 <code>GITHUB_REPO</code> と <code>GITHUB_TOKEN</code>{" "}
          の設定が必要です（README参照）。
        </div>
      )}

      <form action={createProject} className="card form" style={{ maxWidth: 640 }}>
        <label>
          案件ID <span className="req">必須</span>
          <input name="slug" placeholder="afroaster（英小文字・数字・ハイフン）" required pattern="[a-z0-9\-]+" />
        </label>
        <label>
          案件名 <span className="req">必須</span>
          <input name="name" placeholder="アフロースター" required />
        </label>
        <label>
          クライアント名
          <input name="client" placeholder="株式会社〇〇" />
        </label>
        <label>
          サイトURL
          <input name="site_url" type="url" placeholder="https://example.com" />
        </label>

        <fieldset>
          <legend>Search Consoleのプロパティ形式</legend>
          <label className="radio">
            <input type="radio" name="gsc_type" value="prefix" defaultChecked />
            URLプレフィックス（GSCで <code>https://example.com/</code> と表示）
          </label>
          <label className="radio">
            <input type="radio" name="gsc_type" value="domain" />
            ドメイン（GSCで <code>example.com</code> と表示）
          </label>
          <label className="radio">
            <input type="radio" name="gsc_type" value="manual" />
            手動指定:
            <input name="gsc_manual" placeholder='sc-domain:example.com など' style={{ marginTop: 4 }} />
          </label>
        </fieldset>

        <label>
          講師名
          <input name="instructor_name" placeholder="山田太郎" />
        </label>
        <label>
          講師プロフィール
          <input name="instructor_profile" placeholder="AI研修講師。導入支援実績50社。" />
        </label>
        <label>
          ピラーキーワード（1行に1つ）
          <textarea name="keywords" rows={3} placeholder={"キーワード1\nキーワード2"} />
        </label>
        <label>
          案件メモ
          <textarea name="memo" rows={4} placeholder="商材、単価、獲りたい問い合わせ、競合状況など" />
        </label>

        <button type="submit" disabled={!githubEnabled()}>
          案件を追加する
        </button>
      </form>
    </main>
  );
}
