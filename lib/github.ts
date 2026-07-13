/** GitHub Contents API経由でリポジトリにファイルをコミットする。
 * 必要な環境変数:
 *   GITHUB_REPO  = "ユーザー名/リポジトリ名"（例: "sunagou/seo-dashboard"）
 *   GITHUB_TOKEN = Fine-grained PAT（対象リポジトリのContents: Read and write権限）
 */

export function githubEnabled(): boolean {
  return !!process.env.GITHUB_REPO && !!process.env.GITHUB_TOKEN;
}

export type CommitResult = { ok: boolean; reason?: "exists" | "error"; detail?: string };

function apiUrl(filePath: string): string {
  const repo = process.env.GITHUB_REPO!;
  // 日本語パス対応: セグメントごとにエンコード
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${repo}/contents/${encodedPath}`;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN!}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

/** リポジトリ上のファイルを取得（存在しなければnull） */
export async function getRepoFile(
  filePath: string
): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(apiUrl(filePath), {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    content: Buffer.from(data.content || "", "base64").toString("utf-8"),
    sha: data.sha,
  };
}

/** ファイルをコミット。overwrite=falseなら既存ファイルがある場合は失敗を返す */
export async function commitFile(
  filePath: string,
  content: string,
  message: string,
  overwrite = false
): Promise<CommitResult> {
  let sha: string | undefined;
  if (overwrite) {
    const existing = await getRepoFile(filePath);
    if (existing) sha = existing.sha;
  }

  const res = await fetch(apiUrl(filePath), {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });

  if (res.status === 201 || res.status === 200) return { ok: true };
  if (res.status === 422) return { ok: false, reason: "exists" };
  const detail = await res.text().catch(() => "");
  console.error("GitHub commit failed:", res.status, detail.slice(0, 300));
  return { ok: false, reason: "error", detail: `HTTP ${res.status}` };
}

/** サービスアカウントのメールアドレス（GSC追加案内用） */
export function serviceAccountEmail(): string | null {
  try {
    return JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON || "{}").client_email || null;
  } catch {
    return null;
  }
}
