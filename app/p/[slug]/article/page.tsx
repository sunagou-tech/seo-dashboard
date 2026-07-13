import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject, getArticles } from "@/lib/vault";
import {
  getDailyForPage,
  getQueriesForPage,
  range,
  prevRange,
  getTop,
} from "@/lib/gsc";
import { judgeFlags, normalizeUrl } from "@/lib/analysis";
import MetricsChart from "@/components/MetricsChart";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, { label: string; days: number }> = {
  week: { label: "週", days: 7 },
  month: { label: "月", days: 28 },
  all: { label: "全期間", days: 480 },
};

export default async function ArticleDetail({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { u?: string; period?: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const project = getProject(slug);
  const pageUrl = searchParams.u;
  if (!project || !pageUrl) notFound();

  const periodKey = PERIODS[searchParams.period || ""] ? searchParams.period! : "month";
  const { days } = PERIODS[periodKey];
  const r = range(days);
  const pr = prevRange(days);
  const site = project.gscSite || "";

  const article = getArticles(slug).find(
    (a) => a.url && normalizeUrl(a.url) === normalizeUrl(pageUrl)
  );

  const [daily, queries, curPages, prevPages] = await Promise.all([
    getDailyForPage(site, r.startDate, r.endDate, pageUrl),
    getQueriesForPage(site, r.startDate, r.endDate, pageUrl, 30),
    getTop(site, r.startDate, r.endDate, "page", 200),
    getTop(site, pr.startDate, pr.endDate, "page", 200),
  ]);

  const cur = (curPages || []).find(
    (p) => normalizeUrl(p.key) === normalizeUrl(pageUrl)
  );
  const prev = (prevPages || []).find(
    (p) => normalizeUrl(p.key) === normalizeUrl(pageUrl)
  );
  const totalImpressions = (curPages || []).reduce((s, p) => s + p.impressions, 0);
  const flags = judgeFlags(cur, prev, totalImpressions);

  return (
    <main>
      <p className="sub">
        <Link href={`/p/${slug}?period=${periodKey}`}>← {project.name} に戻る</Link>
      </p>
      <h1>{article?.title || pageUrl.replace(/^https?:\/\/[^/]+/, "")}</h1>
      <p className="sub">
        <a href={pageUrl} target="_blank" style={{ textDecoration: "underline" }}>
          {pageUrl}
        </a>
        {article?.published && ` ・ 公開 ${article.published}`}
        {article?.keyword && ` ・ 狙いKW: ${article.keyword}`}
      </p>

      <div className="period-tabs">
        {Object.entries(PERIODS).map(([key, v]) => (
          <Link
            key={key}
            href={`/p/${slug}/article?u=${encodeURIComponent(pageUrl)}&period=${key}`}
            className={key === periodKey ? "active" : ""}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {flags.length > 0 && (
        <div className="notice">
          {flags.map((f) => (
            <p key={f.type} style={{ margin: "2px 0" }}>
              <span className={`flag flag-${f.type}`}>{f.label}</span> {f.reason}
            </p>
          ))}
        </div>
      )}

      <div className="metrics">
        <div className="metric">
          <div className="label">クリック</div>
          <div className="value">{cur ? cur.clicks : 0}</div>
        </div>
        <div className="metric">
          <div className="label">表示回数</div>
          <div className="value">{cur ? cur.impressions : 0}</div>
        </div>
        <div className="metric">
          <div className="label">CTR</div>
          <div className="value">
            {cur ? (cur.ctr * 100).toFixed(1) : "0"}
            <span className="unit">%</span>
          </div>
        </div>
        <div className="metric">
          <div className="label">平均順位</div>
          <div className="value">{cur ? cur.position.toFixed(1) : "–"}</div>
        </div>
      </div>

      {daily && daily.length > 0 && (
        <div className="card">
          <MetricsChart
            data={daily.map((d) => ({
              date: d.date,
              clicks: d.clicks,
              impressions: d.impressions,
            }))}
          />
        </div>
      )}

      <h2>この記事に流入している検索クエリ</h2>
      <div className="card">
        {queries && queries.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>クエリ</th>
                <th className="num">クリック</th>
                <th className="num">表示</th>
                <th className="num">CTR</th>
                <th className="num">順位</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => (
                <tr key={q.key}>
                  <td>{q.key}</td>
                  <td className="num">{q.clicks}</td>
                  <td className="num">{q.impressions}</td>
                  <td className="num">{(q.ctr * 100).toFixed(1)}%</td>
                  <td
                    className={
                      "num " +
                      (q.position <= 3 ? "pos-good" : q.position <= 10 ? "pos-mid" : "")
                    }
                  >
                    {q.position.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="sub" style={{ margin: 0 }}>
            この期間のクエリデータがありません（URLがGSC上の表記と一致しているか確認してください）
          </p>
        )}
      </div>
      <p className="sub" style={{ marginTop: 6 }}>
        💡 使い方: 順位4〜15位のクエリは「見出しに含めて加筆」、表示回数が多く順位が低いクエリは「別記事として切り出し」が定石です。
      </p>
    </main>
  );
}
