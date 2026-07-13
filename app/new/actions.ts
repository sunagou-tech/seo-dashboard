"use server";

import { redirect } from "next/navigation";
import { commitFile, githubEnabled } from "@/lib/github";

function yamlStr(s: string): string {
  return JSON.stringify(s); // JSON文字列は有効なYAML
}

export async function createProject(formData: FormData) {
  const get = (k: string) => String(formData.get(k) || "").trim();

  const slug = get("slug").toLowerCase();
  const name = get("name");
  const client = get("client");
  const siteUrl = get("site_url");
  const gscType = get("gsc_type"); // "domain" | "prefix" | "manual"
  const gscManual = get("gsc_manual");
  const instructorName = get("instructor_name");
  const instructorProfile = get("instructor_profile");
  const keywords = get("keywords")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const memo = get("memo");

  if (!/^[a-z0-9-]+$/.test(slug)) redirect("/new?error=slug");
  if (!name) redirect("/new?error=name");
  if (!githubEnabled()) redirect("/new?error=config");

  const domain = siteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  let gscSite = "";
  if (gscType === "domain") gscSite = `sc-domain:${domain}`;
  else if (gscType === "prefix") gscSite = domain ? `https://${domain}/` : "";
  else gscSite = gscManual;

  const lines = [
    "---",
    `name: ${yamlStr(name)}`,
    client ? `client: ${yamlStr(client)}` : null,
    siteUrl ? `site_url: ${yamlStr(siteUrl.replace(/\/$/, ""))}` : null,
    gscSite ? `gsc_site: ${yamlStr(gscSite)}` : null,
    "status: 運用中",
    `started: ${new Date().toISOString().slice(0, 10)}`,
    instructorName
      ? `講師:\n  name: ${yamlStr(instructorName)}` +
        (instructorProfile ? `\n  profile: ${yamlStr(instructorProfile)}` : "")
      : null,
    keywords.length
      ? "pillar_keywords:\n" + keywords.map((k) => `  - ${yamlStr(k)}`).join("\n")
      : null,
    "---",
    "",
    "## 案件概要",
    "",
    memo || "（ここに案件の詳細を書く。Obsidianからも編集可能）",
    "",
    "## 一次情報の棚卸し",
    "",
    "- この会社しか書けない実績・数値:",
    "- 顧客から実際によく受ける質問:",
    "- 失敗談・現場のビフォーアフター:",
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const result = await commitFile(
    `vault/案件/${slug}/案件情報.md`,
    lines,
    `案件追加: ${name} (${slug})`
  );

  if (!result.ok) {
    redirect(`/new?error=${result.reason === "exists" ? "exists" : "github"}`);
  }
  redirect(`/new?done=${encodeURIComponent(slug)}`);
}
