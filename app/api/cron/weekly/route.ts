import { NextRequest, NextResponse } from "next/server";
import { getProjects, getArticles, countArticles } from "@/lib/vault";
import {
  getSummary,
  getKeywordPosition,
  getTop,
  range,
  prevRange,
  gscEnabled,
} from "@/lib/gsc";
import { rewriteCandidates } from "@/lib/analysis";
import { commitFile, getRepoFile, githubEnabled } from "@/lib/github";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 週次バッチ: 毎週月曜9時(JST)にVercel Cronから起動。
 * - ピラーキーワードの順位を記録（履歴JSONをVaultにコミット）
 * - 週次レポートMDをVaultにコミット（Obsidianで読める）
 * - 順位下落があればSlack通知（SLACK_WEBHOOK_URL設定時）
 * 手動実行: /api/cron/weekly?key=<CRON_SECRET>
 */

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fd = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fd + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function pct(cur: number, prev: number): string {
  if (!prev) return "";
  const p = Math.round(((cur - prev) / prev) * 100);
  return `（前週比 ${p >= 0 ? "+" : ""}${p}%）`;
}

async function notifySlack(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch((e) => console.error("Slack notify failed:", e));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  if (secret && auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!gscEnabled() || !githubEnabled()) {
    return NextResponse.json(
      { error: "GSC_SERVICE_ACCOUNT_JSON / GITHUB_REPO / GITHUB_TOKEN が必要です" },
      { status: 500 }
    );
  }

  const r = range(7);
  const pr = prevRange(7);
  const week = isoWeek(r.endDate);
  const today = new Date().toISOString().slice(0, 10);
  const results: any[] = [];
  const alerts: string[] = [];

  for (const project of getProjects()) {
    const site = project.gscSite;
    if (!site) continue;

    const [summary, prevSummary, curPages, prevPages] = await Promise.all([
      getSummary(site, r.startDate, r.endDate),
      getSummary(site, pr.startDate, pr.endDate),
      getTop(site, r.startDate, r.endDate, "page", 200),
      getTop(site, pr.startDate, pr.endDate, "page", 200),
    ]);

    // --- ピラーキーワード順位 ---
    const positions: Record<string, number | null> = {};
    for (const kw of project.pillarKeywords) {
      const p = await getKeywordPosition(site, r.startDate, r.endDate, kw);
      positions[kw] = p ? Math.round(p.position * 10) / 10 : null;
    }

    // --- 履歴JSONを更新 ---
    const historyPath = `vault/案件/${project.slug}/データ/rank-history.json`;
    const existing = await getRepoFile(historyPath);
    let history: { weeks: any[] } = { weeks: [] };
    if (existing) {
      try {
        history = JSON.parse(existing.content);
      } catch {}
    }
    const prevWeek = history.weeks[history.weeks.length - 1];
    history.weeks = history.weeks.filter((w: any) => w.week !== week);
    history.weeks.push({ week, date: today, positions });
    history.weeks = history.weeks.slice(-52);

    await commitFile(
      historyPath,
      JSON.stringify(history, null, 2),
      `週次順位記録: ${project.name} ${week}`,
      true
    );

    // --- 下落検知 ---
    const drops: string[] = [];
    if (prevWeek) {
      for (const kw of project.pillarKeywords) {
        const cur = positions[kw];
        const prev = prevWeek.positions?.[kw];
        if (cur != null && prev != null && cur - prev >= 2) {
          drops.push(`「${kw}」 ${prev}位 → ${cur}位`);
        }
      }
    }
    if (drops.length) {
      alerts.push(`📉 *${project.name}* 順位下落:\n${drops.join("\n")}`);
    }

    // --- 週次レポートMD ---
    const newArticles = countArticles(getArticles(project.slug), r.startDate);
    const candidates = rewriteCandidates(curPages, prevPages, 5);
    const report = [
      `# 週次レポート ${week}（${r.startDate}〜${r.endDate}）`,
      "",
      `## サマリー`,
      "",
      `- クリック: ${summary?.clicks ?? "–"} ${pct(summary?.clicks || 0, prevSummary?.clicks || 0)}`,
      `- 表示回数: ${summary?.impressions ?? "–"} ${pct(summary?.impressions || 0, prevSummary?.impressions || 0)}`,
      `- 平均順位: ${summary?.position?.toFixed(1) ?? "–"}`,
      `- 新規記事: ${newArticles}本`,
      "",
      `## ピラーキーワード順位`,
      "",
      `| キーワード | 今週 | 先週 | 変動 |`,
      `|---|---|---|---|`,
      ...project.pillarKeywords.map((kw) => {
        const cur = positions[kw];
        const prev = prevWeek?.positions?.[kw];
        const diff =
          cur != null && prev != null
            ? prev - cur > 0
              ? `⬆️ +${(prev - cur).toFixed(1)}`
              : prev - cur < 0
              ? `⬇️ ${(prev - cur).toFixed(1)}`
              : "→"
            : "–";
        return `| ${kw} | ${cur ?? "圏外"} | ${prev ?? "–"} | ${diff} |`;
      }),
      "",
      `## 今週のリライト候補`,
      "",
      ...(candidates.length
        ? candidates.map(
            ({ page, flags }) =>
              `- ${page.key.replace(/^https?:\/\/[^/]+/, "")} — ${flags
                .map((f) => `**${f.label}**: ${f.reason}`)
                .join(" / ")}`
          )
        : ["- なし"]),
      "",
      `## 今週の気づき（手動で追記）`,
      "",
      "- ",
      "",
    ].join("\n");

    await commitFile(
      `vault/案件/${project.slug}/レポート/${week}.md`,
      report,
      `週次レポート: ${project.name} ${week}`,
      true
    );

    results.push({
      project: project.slug,
      week,
      clicks: summary?.clicks,
      positions,
      drops: drops.length,
    });
  }

  // --- 通知 ---
  const summaryText = results
    .map((x) => `・${x.project}: クリック${x.clicks ?? "–"}/週`)
    .join("\n");
  await notifySlack(
    `📊 週次SEOレポート（${week}）を記録しました\n${summaryText}` +
      (alerts.length ? `\n\n${alerts.join("\n\n")}` : "\n\n順位下落はありません")
  );

  return NextResponse.json({ ok: true, week, results });
}
